// Fictional development data, never inserted into a real applicant session.
export const exportFixture={
  id:'fictional-export-qa',scope:'test',facts:[],draft:[],withdrawnFacts:[],
  form:{
    '1.1':{kind:'choice',values:['principal']},
    '1.2':{kind:'text',text:'가상'},'1.3':{kind:'text',text:'테스트'},
    '1.5':{kind:'text',text:'1990/01/01'},'1.8':{kind:'text',text:'교사'},
    '4':{kind:'table',rows:[{relationship:'부',name:'가상 가족',dob:'1960/01/01',nationality:'가상국',city:'가상시'}]},
  },
  question14:{
    '14.1':{kind:'choice',values:['political']},
    '14.1-detail':{kind:'text',text:'저는 정치적 의견 때문에 보호를 신청합니다.'},
    '14.2':{kind:'choice',values:['yes']},
    '14.2-detail':{kind:'text',text:'2025년 봄쯤 평화적인 집회에 참석한 뒤 두 사람이 집에 찾아와 다시 집회에 나가지 말라고 위협했습니다. 경찰 제복처럼 보였지만 실제 소속은 확인하지 못했습니다. 정확한 날짜는 기억나지 않습니다. 저는 구금되거나 다치지는 않았습니다. 그 뒤 다른 도시의 친구 집으로 옮겼습니다. 이 일이 제 정치적 의견 때문이라고 생각하지만 두 사람이 직접 이유를 설명한 것은 아닙니다.'},
    '14.3':{kind:'choice',values:['yes']},
    '14.3-detail':{kind:'text',text:'돌아가면 다시 위협받을까 두렵습니다. 두 사람이 지금도 저를 찾고 있는지는 직접 확인하지 못했습니다.'},
  },
};
