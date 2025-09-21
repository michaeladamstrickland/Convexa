const axios=require('axios');
const API=process.env.API||'http://127.0.0.1:6006';
const fs=require('fs');
const lines=fs.readFileSync('tmp_50.csv','utf8').trim().split(/\r?\n/).slice(1,11);
(async()=>{
  for(const line of lines){
    const parts=line.split(',');
    const addr=;
    const add=await axios.post(,{address:addr,owner_name:null,source_type:'pilot10'}).then(r=>r.data);
    await axios.post(,{}).catch(()=>{});
  }
  console.log('posted=10');
})();
