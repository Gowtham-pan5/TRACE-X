const O="https://trace-x.pages.dev";
const R=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json"}});
const k=x=>String(x??"").trim().slice(0,30).toLowerCase();
async function f(r,e){
 const u=new URL(r.url),p=u.pathname;
 if(!p.startsWith("/api/"))return fetch(O+u.pathname+u.search,r);
 if(!e.DB)return R({error:"D1 unavailable"},503);
 try{
  if(p==="/api/register"&&r.method==="POST"){
   const b=await r.json(),t=String(b.team||"").trim(),m=String(b.members||"");
   if(!t)return R({error:"Team name required"},400);
   await e.DB.prepare("INSERT INTO teams(team_key,team,members,status) VALUES(?,?,?,?) ON CONFLICT(team_key) DO UPDATE SET team=excluded.team,members=excluded.members,updated_at=CURRENT_TIMESTAMP").bind(k(t),t,m,"waiting").run();
   return R({ok:true});
  }
  if(p==="/api/round1"&&r.method==="POST"){
   const b=await r.json(),t=String(b.team||"").trim(),m=String(b.members||"");
   const s=Math.max(0,Math.min(50,Number(b.r1Score)||0)),tm=Math.max(0,Number(b.r1Time)||0),a=JSON.stringify(b.r1Answers||[]);
   if(!t)return R({error:"Team name required"},400);
   await e.DB.prepare("INSERT INTO teams(team_key,team,members,r1_score,r1_time,r1_answers,status) VALUES(?,?,?,?,?,?,?) ON CONFLICT(team_key) DO UPDATE SET members=excluded.members,r1_score=excluded.r1_score,r1_time=excluded.r1_time,r1_answers=excluded.r1_answers,status='waiting',updated_at=CURRENT_TIMESTAMP").bind(k(t),t,m,s,tm,a,"waiting").run();
   return R({status:"waiting"});
  }
  if(p==="/api/round1"&&r.method==="GET"){
   const z=await e.DB.prepare("SELECT status FROM teams WHERE team_key=?").bind(k(u.searchParams.get("team"))).first();
   return R({status:z?.status||"unknown"});
  }
  if(p==="/api/admin/teams"){
   if(!e.ADMIN_PIN)return R({error:"ADMIN_PIN is not configured"},503);
   if(r.headers.get("x-admin-pin")!==e.ADMIN_PIN)return R({error:"Wrong PIN"},401);
   if(r.method==="GET"){
    const z=await e.DB.prepare("SELECT id,team_key,team,members,r1_score AS r1Score,r1_time AS r1Time,r1_answers AS r1Answers,status FROM teams ORDER BY r1_score DESC,r1_time ASC").all();
    return R(z.results||[]);
   }
   const b=await r.json().catch(()=>({}));
   if(r.method==="POST"){
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
   await e.DB.prepare("UPDATE teams SET r2=?,penalty=?,score=?,time=?,status=?,timestamp=?,updated_at=CURRENT_TIMESTAMP WHERE team_key=?").bind(Number(b.r2)||0,Number(b.penalty)||0,Number(b.score)||0,Number(b.time)||0,b.status||"Completed",Number(b.timestamp)||Date.now(),k(t)).run();
   return R({ok:true});
  }
  if(p==="/api/scoreboard"&&r.method==="GET"){
   const z=await e.DB.prepare("SELECT team,members,r1_score AS r1,r2,penalty,score,time,status,timestamp FROM teams ORDER BY score DESC,time ASC").all();
   return R(z.results||[]);
  }
  if(p==="/api/clear"&&r.method==="POST"){
   const b=await r.json();
   if(b.token!=="TRACE2024"&&b.token!=="DELETE")return R({error:"Invalid token"},401);
   await e.DB.prepare("DELETE FROM teams").run();return R({ok:true});
  }
  return R({error:"Not found"},404);
 }catch(x){return R({error:String(x)},500);}
}
export default {fetch:f};
