export function midjourneySourceLink(set){
 const source=set?.source,jobId=source?.mj_job_uuid??source?.origin_mj_job_uuid;
 if(typeof jobId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(jobId))return null;
 const index=!source.mj_job_uuid&&Number.isInteger(source.origin_image_index)&&source.origin_image_index>=1&&source.origin_image_index<=4?source.origin_image_index-1:0;
 return {jobId,url:'https://www.midjourney.com/jobs/'+jobId+'?index='+index};
}
