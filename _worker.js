const R=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json"}});
const k=x=>String(x??"").trim().slice(0,30).toLowerCase();
async function f(r,e){
 const u=new URL(r.url),p=u.pathname;
 if(!p.startsWith("/api/"))return e.ASSETS.fetch(r);
 if(!e.DB)return R({error:"D1 unavailable"},503);
 try{
  if(p==="/api/register"&&r.method==="POST"){
   const b=await r.json(),t=String(b.team||"").trim(),m=String(b.members||"").trim(),cl=String(b.className||"").trim();
   if(!t)return R({error:"Team name required"},400);
   await e.DB.prepare("INSERT INTO teams(team_key,team,members,status,admission_status) VALUES(?,?,?,?,?) ON CONFLICT(team_key) DO UPDATE SET team=excluded.team,members=excluded.members,status='waiting',admission_status='pending',updated_at=CURRENT_TIMESTAMP").bind(k(t),t,[m,cl].filter(Boolean).join(" • "),"waiting","pending").run();
   const g=await e.DB.prepare("SELECT version FROM game_control WHERE id=1").first();
   return R({ok:true,status:"pending",gameVersion:g?.version||1});
  }
  if(p==="/api/round1"&&r.method==="POST"){
   const b=await r.json(),t=String(b.team||"").trim(),m=String(b.members||"");
   const s=Math.max(0,Math.min(50,Number(b.r1Score)||0)),tm=Math.max(0,Number(b.r1Time)||0),a=JSON.stringify(b.r1Answers||[]);
   if(!t)return R({error:"Team name required"},400);
   const g=await e.DB.prepare("SELECT version FROM game_control WHERE id=1").first();
   if(Number(b.gameVersion)!==Number(g?.version||1))return R({error:"Game was restarted. Please register again.",code:"GAME_RESTARTED"},409);
   const q=await e.DB.prepare("SELECT admission_status FROM teams WHERE team_key=?").bind(k(t)).first();
   if(q?.admission_status!=="approved")return R({error:"Team is not approved to play",status:q?.admission_status||"unknown"},403);
   await e.DB.prepare("UPDATE teams SET members=?,r1_score=?,r1_time=?,r1_answers=?,status='waiting',updated_at=CURRENT_TIMESTAMP WHERE team_key=?").bind(m,s,tm,a,k(t)).run();
   return R({status:"waiting"});
  }
  if(p==="/api/round1"&&r.method==="GET"){
   const z=await e.DB.prepare("SELECT status,admission_status FROM teams WHERE team_key=?").bind(k(u.searchParams.get("team"))).first();
   return R({status:z?.status||"unknown",admissionStatus:z?.admission_status||"unknown"});
  }
  if(p==="/api/admin/teams"){
   if(!e.ADMIN_PIN)return R({error:"ADMIN_PIN is not configured"},503);
   if(r.headers.get("x-admin-pin")!==e.ADMIN_PIN)return R({error:"Wrong PIN"},401);
   if(r.method==="GET"){
    const z=await e.DB.prepare("SELECT id,team_key,team,members,r1_score AS r1Score,r1_time AS r1Time,r1_answers AS r1Answers,status,admission_status AS admissionStatus FROM teams ORDER BY r1_score DESC,r1_time ASC").all();
    return R(z.results||[]);
   }
   const b=await r.json().catch(()=>({}));
   if(r.method==="POST"){
    if(b.mode==="admission"){
      if(!["approved","rejected","pending"].includes(String(b.admissionStatus)))return R({error:"Invalid admission status"},400);
      if(b.allPending)await e.DB.prepare("UPDATE teams SET admission_status=? WHERE admission_status='pending'").bind(b.admissionStatus).run();
      else await e.DB.prepare("UPDATE teams SET admission_status=? WHERE team_key=?").bind(b.admissionStatus,k(b.team)).run();
      return R({ok:true});
    }
    if(!["approved","rejected","waiting"].includes(String(b.status)))return R({error:"Invalid status"},400);
    if(b.allWaiting)await e.DB.prepare("UPDATE teams SET status=? WHERE status='waiting'").bind(b.status).run();
    else await e.DB.prepare("UPDATE teams SET status=? WHERE team_key=?").bind(b.status,k(b.team)).run();
    return R({ok:true});
   }
   if(r.method==="DELETE"){await e.DB.prepare("DELETE FROM teams").run();return R({ok:true});}
  }
  if(p==="/api/submit"&&r.method==="POST"){
   const b=await r.json(),t=String(b.team||"").trim();
   if(!t)return R({error:"Team name required"},400);
   const g=await e.DB.prepare("SELECT version FROM game_control WHERE id=1").first();
   if(Number(b.gameVersion)!==Number(g?.version||1))return R({error:"Game was restarted. Please register again.",code:"GAME_RESTARTED"},409);
   await e.DB.prepare("UPDATE teams SET r2=?,penalty=?,score=?,time=?,status=?,timestamp=?,updated_at=CURRENT_TIMESTAMP WHERE team_key=?").bind(Number(b.r2)||0,Number(b.penalty)||0,Number(b.score)||0,Number(b.time)||0,b.status||"Completed",Number(b.timestamp)||Date.now(),k(t)).run();
   return R({ok:true});
  }
  if(p==="/api/scoreboard"&&r.method==="GET"){
   const z=await e.DB.prepare("SELECT team,members,r1_score AS r1,r2,penalty,score,time,status,timestamp FROM teams ORDER BY score DESC,time ASC").all();
   return R(z.results||[]);
  }
  if(p==="/api/game"&&r.method==="GET"){
   const g=await e.DB.prepare("SELECT version FROM game_control WHERE id=1").first();
   return R({version:g?.version||1});
  }
  if(p==="/api/admin/restart"&&r.method==="POST"){
   if(!e.ADMIN_PIN)return R({error:"ADMIN_PIN is not configured"},503);
   if(r.headers.get("x-admin-pin")!==e.ADMIN_PIN)return R({error:"Wrong PIN"},401);
   await e.DB.prepare("DELETE FROM teams").run();
   await e.DB.prepare("UPDATE game_control SET version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=1").run();
   const g=await e.DB.prepare("SELECT version FROM game_control WHERE id=1").first();
   return R({ok:true,version:g?.version||1});
  }
  if(p==="/api/clear"&&r.method==="POST"){
   const b=await r.json();
   if(String(b.token??"")!==String(e.ADMIN_PIN??""))return R({error:"Invalid token"},401);
   await e.DB.prepare("DELETE FROM teams").run();return R({ok:true});
  }
  return R({error:"Not found"},404);
 }catch(x){return R({error:String(x)},500);}
}
export default {fetch:f};
