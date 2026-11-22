import test from 'node:test';import assert from 'node:assert/strict';import{midjourneySourceLink}from'./source-link.mjs';
test('repaired clips link their original MJ UUID, with a fixed trusted origin',()=>{
 const jobId='d8177deb-5bb5-4484-aa00-3ccc7e2f300a';assert.deepEqual(midjourneySourceLink({source:{mj_job_uuid:jobId,processing:'reversed'}}),{jobId,url:'https://www.midjourney.com/jobs/'+jobId+'?index=0'});
 assert.equal(midjourneySourceLink({source:{origin_mj_job_uuid:jobId,origin_image_index:3}}).url.endsWith('?index=2'),true);
 assert.equal(midjourneySourceLink({source:{mj_job_uuid:jobId,batch_size:4,batch_output:4}}).url.endsWith('?index=3'),true);
 for(const source of [{provider:'Pika',job_id:'creation_example'},{mj_job_uuid:'javascript:alert(1)'},{mj_job_uuid:jobId+'/other'},{}])assert.equal(midjourneySourceLink({source}),null);
});
