const copy={
 ko:{count:'{n}가지 내용을 꼭 확인해 주세요',method:'내용을 읽고 이해했다면 체크해 주세요.',progress:'확인',ready:'모두 확인했어요'},
 en:{count:'Please check these {n} points',method:'Check each point after reading and understanding it.',progress:'Checked',ready:'All points checked'},
 fr:{count:'Vérifiez ces {n} points',method:'Cochez chaque point après l’avoir lu et compris.',progress:'Vérifié',ready:'Tous les points sont vérifiés'},
 ru:{count:'Пожалуйста, проверьте {n} пунктов',method:'Отметьте каждый пункт после прочтения и понимания.',progress:'Проверено',ready:'Все пункты проверены'},
 ar:{count:'يرجى مراجعة هذه النقاط وعددها {n}',method:'ضع علامة بعد قراءة كل نقطة وفهمها.',progress:'تمت المراجعة',ready:'تمت مراجعة جميع النقاط'},
 fa:{count:'لطفاً این {n} مورد را بررسی کنید',method:'پس از خواندن و فهمیدن هر مورد، آن را علامت بزنید.',progress:'بررسی‌شده',ready:'همه موارد بررسی شدند'},
};
export const guidanceFlowCopy=(language:string)=>copy[language as keyof typeof copy]??copy.en;
