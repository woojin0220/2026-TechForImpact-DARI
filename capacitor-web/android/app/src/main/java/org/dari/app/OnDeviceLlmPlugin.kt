package org.dari.app

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.Debug
import android.os.PowerManager
import android.os.SystemClock
import android.provider.OpenableColumns
import androidx.activity.result.ActivityResult
import com.getcapacitor.*
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.ai.edge.litertlm.*
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@OptIn(ExperimentalApi::class)
@CapacitorPlugin(name = "OnDeviceLlm")
class OnDeviceLlmPlugin : Plugin() {
    private val worker = Executors.newSingleThreadExecutor()
    private val busy = AtomicBoolean(false)
    private val cancelled = AtomicBoolean(false)
    private val conversationGuard = Any()
    private var engine: Engine? = null
    /** "backend/maxNumTokens" of the loaded engine; a benchmark asking for another config reloads it. */
    private var engineKey: String? = null
    @Volatile private var conversation: Conversation? = null
    private val modelFile get() = File(context.noBackupFilesDir, "dari-model.litertlm")
    private val preferences get() = context.getSharedPreferences("dari-llm", 0)

    private fun status() = JSObject().apply {
        put("platform", "android"); put("available", true)
        put("modelReady", modelFile.isFile && modelFile.length() > 0)
        put("modelPath", modelFile.absolutePath)
        put("modelName", preferences.getString("name", ""))
        put("backend", engineKey?.substringBefore('/') ?: "")
        put("busy", busy.get())
        put("device", JSObject().apply {
            put("manufacturer", Build.MANUFACTURER); put("model", Build.MODEL); put("sdk", Build.VERSION.SDK_INT)
            if (Build.VERSION.SDK_INT >= 31) put("soc", "${Build.SOC_MANUFACTURER} ${Build.SOC_MODEL}")
            put("totalRamMB", memoryInfo().totalMem / 1_048_576)
        })
    }

    private fun memoryInfo() = ActivityManager.MemoryInfo().also {
        (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(it)
    }

    /** VmRSS / VmHWM from /proc in MB. GPU buffers may live outside RSS, so PSS is reported too. */
    private fun procStatusMB(key: String): Long? = try {
        File("/proc/self/status").useLines { lines ->
            lines.firstOrNull { it.startsWith("$key:") }?.trim()?.split(Regex("\\s+"))?.getOrNull(1)?.toLong()?.div(1024)
        }
    } catch (_: Exception) { null }

    /** Resets the peak RSS so VmHWM covers one call; not every kernel allows it. */
    private fun resetPeakRss() = try { File("/proc/self/clear_refs").writeText("5"); true } catch (_: Exception) { false }

    /** Measurements for one generate call; collected after timing so they do not inflate it. */
    private fun deviceStats(stats: JSObject, peakReset: Boolean) {
        procStatusMB("VmRSS")?.let { stats.put("rssMB", it) }
        procStatusMB("VmHWM")?.let { stats.put("peakRssMB", it) }
        stats.put("peakReset", peakReset)
        stats.put("pssMB", Debug.MemoryInfo().also { Debug.getMemoryInfo(it) }.totalPss / 1024)
        stats.put("availMemMB", memoryInfo().availMem / 1_048_576)
        if (Build.VERSION.SDK_INT >= 29) stats.put("thermal", (context.getSystemService(Context.POWER_SERVICE) as PowerManager).currentThermalStatus.toString())
        context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))?.let { battery ->
            battery.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1).takeIf { it >= 0 }?.let { stats.put("batteryTempC", it / 10.0) }
            val level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1); val scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            if (level >= 0 && scale > 0) stats.put("batteryLevel", level * 100 / scale)
        }
    }

    @PluginMethod fun getStatus(call: PluginCall) = call.resolve(status())

    @PluginMethod fun importModel(call: PluginCall) {
        if (!busy.compareAndSet(false, true)) { call.reject("모델이 작업 중입니다."); return }
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            type = "*/*"; addCategory(Intent.CATEGORY_OPENABLE)
        }
        try { startActivityForResult(call, intent, "modelPicked") }
        catch (e: Exception) { busy.set(false); call.reject("파일 선택기를 열 수 없습니다.", e) }
    }

    @ActivityCallback private fun modelPicked(call: PluginCall?, result: ActivityResult) {
        if (call == null) { busy.set(false); return }
        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) {
            busy.set(false); call.reject("모델 가져오기를 취소했습니다.", "CANCELLED"); return
        }
        worker.execute {
            val temporary = File(context.noBackupFilesDir, "dari-model.importing")
            try {
                val name = context.contentResolver.query(uri, null, null, null, null)?.use {
                    if (it.moveToFirst()) it.getString(it.getColumnIndexOrThrow(OpenableColumns.DISPLAY_NAME)) else ""
                } ?: ""
                require(name.endsWith(".litertlm", ignoreCase = true)) { ".litertlm 모델 파일을 선택해 주세요." }
                context.contentResolver.openInputStream(uri).use { input ->
                    requireNotNull(input) { "모델 파일을 읽을 수 없습니다." }
                    temporary.outputStream().use { output -> input.copyTo(output) }
                }
                require(temporary.length() > 0) { "빈 모델 파일입니다." }
                engine?.close(); engine = null; engineKey = null
                // Atomic rename preserves the old model if copying fails or storage runs out.
                check(temporary.renameTo(modelFile)) { "모델을 저장할 수 없습니다." }
                preferences.edit().putString("name", name).apply()
                busy.set(false); call.resolve(status())
            } catch (e: Exception) {
                temporary.delete(); busy.set(false); call.reject(e.message ?: "모델 가져오기 실패", e)
            }
        }
    }

    @PluginMethod fun generate(call: PluginCall) {
        val prompt = call.getString("prompt") ?: ""
        if (prompt.isBlank()) { call.reject("입력 내용이 없습니다."); return }
        if (!modelFile.isFile) { call.reject("먼저 .litertlm 모델 파일을 가져와 주세요.", "MODEL_MISSING"); return }
        // Benchmark options; the app's defaults are GPU, 16k context and no constrained decoding.
        val backendName = if (call.getString("backend") == "cpu") "cpu" else "gpu"
        val maxNumTokens = (call.getInt("maxNumTokens") ?: 16384).coerceIn(1024, 32768)
        val schema = call.getObject("responseSchema")
        if (!busy.compareAndSet(false, true)) { call.reject("모델이 작업 중입니다.", "BUSY"); return }
        cancelled.set(false)
        worker.execute {
            try {
                val started = SystemClock.elapsedRealtime()
                val peakReset = resetPeakRss()
                var initMs: Long? = null
                val key = "$backendName/$maxNumTokens"
                if (engineKey != key) { engine?.close(); engine = null; engineKey = null }
                val loaded = engine ?: run {
                    // Read only when an engine is created; it adds per-call timing counters.
                    ExperimentalFlags.enableBenchmark = true
                    Engine(EngineConfig(
                        modelPath = modelFile.absolutePath, backend = if (backendName == "cpu") Backend.CPU() else Backend.GPU(),
                        maxNumTokens = maxNumTokens, cacheDir = context.cacheDir.absolutePath,
                    )).also { candidate ->
                        try { candidate.initialize(); engine = candidate; engineKey = key; initMs = SystemClock.elapsedRealtime() - started }
                        catch (e: Exception) { candidate.close(); throw e }
                    }
                }
                check(!cancelled.get()) { "요청을 취소했습니다." }
                val config = ConversationConfig(
                    systemInstruction = Contents.of(call.getString("system") ?: ""),
                    samplerConfig = SamplerConfig(40, 0.95, (call.getDouble("temperature") ?: 0.2).coerceIn(0.0, 2.0)),
                    maxOutputToken = (call.getInt("maxTokens") ?: 2048).coerceIn(64, 4096),
                    thinkingConfig = ThinkingConfig(enableThinking = false),
                    enableResponseFormat = schema != null,
                )
                val active = loaded.createConversation(config)
                try {
                    synchronized(conversationGuard) { conversation = active }
                    check(!cancelled.get()) { "요청을 취소했습니다." }
                    val response = active.sendMessage(prompt, responseFormat = schema?.let { ResponseFormat.json(it.toString()) }).toString()
                    val totalMs = SystemClock.elapsedRealtime() - started
                    check(!cancelled.get()) { "요청을 취소했습니다." }
                    check(response.isNotBlank()) { "모델이 결과를 반환하지 않았습니다." }
                    val stats = JSObject().apply {
                        put("runtime", "litertlm"); put("backend", backendName); put("maxNumTokens", maxNumTokens)
                        put("constrained", schema != null); put("totalMs", totalMs)
                        initMs?.let { put("initMs", it) }
                    }
                    try {
                        val info = active.getBenchmarkInfo()
                        stats.put("ttftMs", Math.round(info.timeToFirstTokenInSecond * 1000))
                        stats.put("prefillTokens", info.lastPrefillTokenCount); stats.put("decodeTokens", info.lastDecodeTokenCount)
                        stats.put("prefillTokPerSec", Math.round(info.lastPrefillTokensPerSecond * 10) / 10.0)
                        stats.put("decodeTokPerSec", Math.round(info.lastDecodeTokensPerSecond * 10) / 10.0)
                    } catch (_: Exception) { }
                    try { deviceStats(stats, peakReset) } catch (_: Exception) { }
                    call.resolve(JSObject().put("text", response).put("stats", stats))
                } finally {
                    // A cancellation must never race native handle deletion.
                    synchronized(conversationGuard) {
                        conversation = null
                        active.close()
                    }
                }
            } catch (e: Exception) { call.reject(e.message ?: "온디바이스 생성 실패", e) }
            finally { conversation = null; busy.set(false) }
        }
    }

    @PluginMethod fun cancel(call: PluginCall) {
        cancelled.set(true)
        try { synchronized(conversationGuard) { conversation?.cancelProcess() }; call.resolve() }
        catch (e: Exception) { call.reject("중단 요청에 실패했습니다.", e) }
    }

    override fun handleOnDestroy() {
        cancelled.set(true)
        try { synchronized(conversationGuard) { conversation?.cancelProcess() } } catch (_: Exception) { }
        worker.execute { engine?.close(); engine = null; engineKey = null }
        worker.shutdown()
        super.handleOnDestroy()
    }
}
