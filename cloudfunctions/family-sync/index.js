const cloud=require('wx-server-sdk');const crypto=require('crypto');cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});const db=cloud.database(),_=db.command;const FAMILY='household-v1',COL='family_assets_private';const safe=s=>typeof s==='string'?s:'';const digest=s=>crypto.createHash('sha256').update(s).digest('hex');const fail=(code,message)=>({ok:false,code,message});
exports.main=async event=>{
 const openid=cloud.getWXContext().OPENID;if(!openid)return fail('AUTH','无法识别微信用户');
 const action=safe(event.action);const ref=db.collection(COL).doc(FAMILY);
 if(action==='status'||action==='read'){
  try{const r=await ref.get(),f=r.data;if(!f.members.includes(openid))return fail('UNAUTHORIZED','尚未授权此微信账号');
   if(action==='status')return {ok:true,joined:true,revision:f.revision,role:f.owner===openid?'owner':'member'};
   return {ok:true,joined:true,revision:f.revision,data:f.data||null,role:f.owner===openid?'owner':'member'};
  }catch(e){if(e.errCode===-1||/not exist|does not exist|DOCUMENT_NOT_FOUND/i.test(e.message||''))return {ok:true,joined:false};return fail('DB_ERROR','读取失败：'+e.message)}
 }
 if(action==='setup'){
  const secret=process.env.FAMILY_SETUP_CODE;
  if(!secret||secret.length<12)return fail('NOT_CONFIGURED','请先配置云函数环境变量 FAMILY_SETUP_CODE（至少12位）');
  if(safe(event.code)!==secret)return fail('BAD_CODE','初始化口令不正确');
  try{await ref.create({data:{owner:openid,members:[openid],revision:0,data:null,inviteHash:'',inviteUntil:0,createdAt:db.serverDate()}});return {ok:true,joined:true,revision:0,role:'owner'}}catch(e){return fail('ALREADY_SETUP','家庭空间已存在，请使用受邀微信加入')}
 }
 if(action==='invite'){
  try{const f=(await ref.get()).data;if(f.owner!==openid)return fail('FORBIDDEN','仅管理员可邀请');
   const code=crypto.randomBytes(8).toString('hex').toUpperCase();await ref.update({data:{inviteHash:digest(code),inviteUntil:Date.now()+10*60*1000}});return {ok:true,code,expiresInMinutes:10}
  }catch(e){return fail('DB_ERROR','生成邀请码失败')}
 }
 if(action==='join'){
  const code=safe(event.code).trim().toUpperCase();if(!/^[0-9A-F]{16}$/.test(code))return fail('BAD_CODE','邀请码格式错误');
  try{const f=(await ref.get()).data;if(f.members.includes(openid))return {ok:true,joined:true,revision:f.revision};
   if(f.members.length>=2)return fail('FULL','家庭成员已达两人');
   if(Date.now()>f.inviteUntil||digest(code)!==f.inviteHash)return fail('BAD_CODE','邀请码错误或已过期');
   const r=await db.collection(COL).where({_id:FAMILY,revision:f.revision,inviteHash:f.inviteHash}).update({data:{members:_.push(openid),inviteHash:'',inviteUntil:0}});
   if(!r.stats.updated)return fail('CONFLICT','邀请码已被使用，请重新生成');return {ok:true,joined:true,revision:f.revision}
  }catch(e){return fail('DB_ERROR','加入失败：'+e.message)}
 }
 if(action==='write'){
  const payload=event.data,revision=event.revision;
  if(!payload||typeof payload!=='object'||!Array.isArray(payload.assets)||!Array.isArray(payload.accounts)||!Array.isArray(payload.snapshots)||!Array.isArray(payload.transactions||[])||!Array.isArray(payload.flows||[])||!payload.rates||!Number.isInteger(revision)||revision<0)return fail('INVALID','数据格式不正确');
  if(JSON.stringify(payload).length>800000)return fail('TOO_LARGE','数据超过云端单次保存限制');
  try{const f=(await ref.get()).data;if(!f.members.includes(openid))return fail('UNAUTHORIZED','无权写入家庭数据');
   const result=await db.collection(COL).where({_id:FAMILY,revision}).update({data:{data:payload,revision:_.inc(1),updatedAt:db.serverDate(),updatedBy:openid}});
   if(!result.stats.updated)return fail('CONFLICT','云端已有更新，请先同步，避免覆盖其他设备');
   return {ok:true,revision:revision+1}
  }catch(e){return fail('DB_ERROR','保存失败：'+e.message)}
 }
 return fail('INVALID_ACTION','未知操作');
};