const cloud=require('wx-server-sdk');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const db=cloud.database(),cmd=db.command,COL='family_assets_private',ID='household-v1';
const err=(code,message)=>({ok:false,code,message});
async function read(){try{return (await db.collection(COL).doc(ID).get()).data}catch(e){if(/not exist|does not exist|not found/i.test(e.message||''))return null;throw e}}
exports.main=async(event={})=>{
 try{
  const f=await read();
  if(event.action==='status')return {ok:true,joined:true,revision:f?f.revision:0,hasData:!!(f&&f.data)};
  if(event.action==='read')return {ok:true,joined:true,revision:f?f.revision:0,data:f?f.data:null};
  if(event.action!=='write')return err('INVALID_ACTION','不支持的操作');
  const d=event.data,rev=event.revision;
  if(!d||!Array.isArray(d.assets)||!Array.isArray(d.accounts)||!Array.isArray(d.snapshots)||!d.rates||!Number.isInteger(rev)||rev<0)return err('INVALID','数据格式错误');
  if(JSON.stringify(d).length>800000)return err('TOO_LARGE','数据过大');
  if(!f){
   if(rev!==0)return err('CONFLICT','版本不一致');
   try{await db.collection(COL).add({data:{_id:ID,revision:1,data:d,updatedAt:db.serverDate()}});return {ok:true,revision:1}}catch(e){return err('CREATE_ERROR',e.message)}
  }
  if(f.revision!==rev)return err('CONFLICT','其他设备已经更新，请先下载');
  const r=await db.collection(COL).where({_id:ID,revision:rev}).update({data:{data:d,revision:cmd.inc(1),updatedAt:db.serverDate()}});
  return r.stats.updated?{ok:true,revision:rev+1}:err('CONFLICT','云端数据已变化');
 }catch(e){return err('DB_ERROR',e.message||String(e))}
};