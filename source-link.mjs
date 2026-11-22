export function midjourneySourceLink(set){
 const source=set?.source,jobId=source?.mj_job_uuid??source?.origin_mj_job_uuid;
 if(typeof jobId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(jobId))return null;
 const output=source.mj_job_uuid?source.batch_output:source.origin_image_index;
 const index=Number.isInteger(output)&&output>=1&&output<=4?output-1:0;
 return {jobId,url:'https://www.midjourney.com/jobs/'+jobId+'?index='+index};
}
