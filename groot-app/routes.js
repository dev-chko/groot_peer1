//SPDX-License-Identifier: Apache-2.0

var groot = require('./controller.js'); 

module.exports = function(app){
   
  app.get('/add_cont/:groot', function(req, res){  // 기술등록(임치) 
    groot.add_cont(req, res);
  });
  app.get('/add_client/:client', function(req, res){ // 사용자 편입
    groot.add_client(req, res);
  });
  app.get('/change_term/:term', function(req, res){ // 기술 연장
    groot.change_term(req, res);
  });
  app.get('/add_content/:content', function(req, res){ // 기술 갱신(추가)
    groot.add_content(req, res);
  });
  app.get('/get_cert_verify/:cert', function(req, res){ // 증명서 발급 및 문서 원본검증
    groot.get_cert_verify(req, res);
  });
  app.get('/get_tech/:id', function(req, res){ // 기술 열람
    groot.get_tech(req, res);
  });
  app.get('/get_all_tech', function(req, res){ // groot_scan을 위한 전체 기술 열람
    groot.get_all_tech(req, res);
  });
  app.get('/query_tech', function(req, res){ // groot_scan을 위한 전체 기술 정렬 열람(조건에 맞춰)
    groot.query_tech(req, res);
  });
}
 
