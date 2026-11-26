/* Namespace separation only; this is not encryption or an authorization boundary. */
(function () {
  'use strict';
  var requested = new URLSearchParams(window.location.search).get('ownerScope');
  var scope = requested && /^(account:[A-Za-z0-9_-]{1,128}|guest)$/.test(requested) ? requested : 'standalone';
  window.DariProcedureScope = Object.freeze({
    owner: scope,
    key: function (base) { return base + '.owner.' + encodeURIComponent(scope); },
    backup: function (record) { return Object.assign({}, record, {ownerScope: scope}); },
    readBackup: function (record) {
      if (!record || (record.ownerScope !== undefined && record.ownerScope !== scope)) {
        var messages={ko:'다른 계정의 백업은 이 계정에서 열 수 없어요.',en:'This backup belongs to a different account.',fr:'Cette sauvegarde appartient à un autre compte.',ru:'Эта копия принадлежит другому аккаунту.',ar:'هذه النسخة الاحتياطية تخص حسابًا آخر.',fa:'این نسخه پشتیبان متعلق به حساب دیگری است.'};
        throw new Error(messages[new URLSearchParams(window.location.search).get('lang')]||messages.en);
      }
      // A legacy file is read only when the user explicitly chooses it for import.
      return record;
    }
  });
})();
