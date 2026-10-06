package org.dari.app

import android.app.Activity
import android.content.Intent
import android.provider.OpenableColumns
import androidx.activity.result.ActivityResult
import com.getcapacitor.*
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.ai.edge.litertlm.*
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@CapacitorPlugin(name = "OnDeviceLlm")
class OnDeviceLlmPlugin : Plugin() {
    private val worker = Executors.newSingleThreadExecutor()
    private val busy = AtomicBoolean(false)
    private val cancelled = AtomicBoolean(false)
    private val conversationGuard = Any()
    private var engine: Engine? = null
    @Volatile private var conversation: Conversation? = null
    private val modelFile get() = File(context.noBackupFilesDir, "dari-model.litertlm")
    private val preferences get() = context.getSharedPreferences("dari-llm", 0)

    private fun status() = JSObject().apply {
        put("platform", "android"); put("available", true)
        put("modelReady", modelFile.isFile && modelFile.length() > 0)
        put("modelPath", modelFile.absolutePath)
        put("modelName", preferences.getString("name", ""))
        put("busy", busy.get())
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
                engine?.close(); engine = null
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
        if (!busy.compareAndSet(false, true)) { call.reject("모델이 작업 중입니다.", "BUSY"); return }
        cancelled.set(false)
        worker.execute {
            try {
                val loaded = engine ?: Engine(EngineConfig(
                    modelPath = modelFile.absolutePath, backend = Backend.GPU(),
                    maxNumTokens = 16384, cacheDir = context.cacheDir.absolutePath,
                )).also { candidate ->
                    try { candidate.initialize(); engine = candidate }
                    catch (e: Exception) { candidate.close(); throw e }
                }
                check(!cancelled.get()) { "요청을 취소했습니다." }
                val config = ConversationConfig(
                    systemInstruction = Contents.of(call.getString("system") ?: ""),
                    samplerConfig = SamplerConfig(40, 0.95, (call.getDouble("temperature") ?: 0.2).coerceIn(0.0, 2.0)),
                    maxOutputToken = (call.getInt("maxTokens") ?: 2048).coerceIn(64, 4096),
                    thinkingConfig = ThinkingConfig(enableThinking = false),
                )
                val active = loaded.createConversation(config)
                try {
                    synchronized(conversationGuard) { conversation = active }
                    check(!cancelled.get()) { "요청을 취소했습니다." }
                    val response = active.sendMessage(prompt).toString()
                    check(!cancelled.get()) { "요청을 취소했습니다." }
                    check(response.isNotBlank()) { "모델이 결과를 반환하지 않았습니다." }
                    call.resolve(JSObject().put("text", response))
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
        worker.execute { engine?.close(); engine = null }
        worker.shutdown()
        super.handleOnDestroy()
    }
}
