@echo off
title MineCord - Config Check

echo ================================
echo      MineCord Config Check
echo ================================
echo.

:: Check for Node.js
node -v >nul 2>&1
if errorlevel 1 (
  echo ❌ Node.js is NOT installed.
  echo Install Node.js 18+ from: https://nodejs.org/
  pause
  exit /b 1
)

:: Check .env exists
if not exist ".env" (
  echo ❌ Missing .env file in project root.
  echo Create it (you can copy from .env.example).
  pause
  exit /b 1
)

echo ✅ Node.js detected.
echo ✅ .env found.
echo.

:: Validate config with Node inline script
node -e ^
"const fs=require('fs'); const path=require('path');" ^
"function die(msg){console.error('❌ '+msg); process.exit(1)}" ^
"function ok(msg){console.log('✅ '+msg)}" ^
"function warn(msg){console.log('⚠️ '+msg)}" ^
"function parseEnv(file){const t=fs.readFileSync(file,'utf8'); const out={}; for(const line of t.split(/\r?\n/)){const s=line.trim(); if(!s||s.startsWith('#')) continue; const i=s.indexOf('='); if(i<0) continue; const k=s.slice(0,i).trim(); const v=s.slice(i+1).trim(); out[k]=v;} return out;}" ^
"const env=parseEnv('.env'); if(!env.DISCORD_TOKEN) die('DISCORD_TOKEN missing in .env'); ok('DISCORD_TOKEN present');" ^
"const botsPath=path.join(process.cwd(),'bots.json'); const hasBots=fs.existsSync(botsPath);" ^
"if(hasBots){" ^
"  let json; try{json=JSON.parse(fs.readFileSync(botsPath,'utf8'));}catch(e){die('bots.json is not valid JSON: '+e.message)}" ^
"  if(!json || !Array.isArray(json.bots) || json.bots.length===0) die('bots.json must contain { \"bots\": [ ... ] } with at least 1 bot');" ^
"  ok('bots.json found (multi-bot mode)');" ^
"  const required=['name','channelId','host','username'];" ^
"  const seenChannels=new Set();" ^
"  json.bots.forEach((b,idx)=>{" ^
"    const where=`bots[${idx}]`; if(!b||typeof b!=='object') die(where+' is not an object');" ^
"    for(const k of required){ if(!b[k]) die(where+' missing '+k); }" ^
"    if(!/^\d{15,25}$/.test(String(b.channelId))) die(where+' channelId looks wrong (should be a Discord channel ID number)');" ^
"    if(seenChannels.has(String(b.channelId))) die(where+' duplicate channelId (each bot needs its own channel)');" ^
"    seenChannels.add(String(b.channelId));" ^
"    if(b.port && Number.isNaN(Number(b.port))) die(where+' port must be a number');" ^
"    if(b.auth && !['microsoft','mojang','offline'].includes(String(b.auth).toLowerCase())) warn(where+' auth is unusual (expected microsoft/mojang/offline)');" ^
"  });" ^
"  ok(`Validated ${json.bots.length} bot(s) in bots.json`);" ^
"} else {" ^
"  ok('bots.json not found (single-bot mode)');" ^
"  const needed=['DISCORD_CHANNEL_ID','MC_HOST','MC_USERNAME'];" ^
"  for(const k of needed){ if(!env[k]) die(k+' missing in .env (single-bot mode)'); }" ^
"  if(!/^\d{15,25}$/.test(String(env.DISCORD_CHANNEL_ID))) die('DISCORD_CHANNEL_ID looks wrong (should be a Discord channel ID number)');" ^
"  ok('Single-bot fields look good');" ^
"}" ^
"console.log('\\n✅ Config looks good. You can run start.bat / npm run dev');"

if errorlevel 1 (
  echo.
  echo ❌ Config check failed.
  pause
  exit /b 1
)

echo.
pause
