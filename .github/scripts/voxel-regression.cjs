const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true
  });
  const errors = [];
  const results = [];
  page.on('pageerror', e => errors.push(e.message));

  function check(name, condition, details = '') {
    results.push({ name, passed: !!condition, details });
    console.log((condition ? 'PASS ' : 'FAIL ') + name + (details ? ': ' + details : ''));
    if (!condition) throw new Error(name + (details ? ': ' + details : ''));
  }

  try {
    await page.route('**/voxel-craft-tools-v7-1.html', async route => {
      const response = await route.fetch();
      let html = await response.text();
      const marker = 'requestAnimationFrame(loop);\naddEventListener(\'resize\'';
      const injected = `window.__voxelDebug = {
        state: () => ({ x:pX, y:pY, z:pZ, feet:pY-playerHeight, vY, onGround, moveVX, moveVZ, yaw, pitch, blocks:blocks.size }),
        floor: (x,z,feet) => groundBelow(x,z,feet),
        collides: (x,z,feet) => collidesAt(x,z,feet),
        setPlayer: (x,z,feet) => { pX=x; pZ=z; pY=feet+playerHeight; vY=0; moveVX=0; moveVZ=0; onGround=true; },
        addBlock: (x,y,z,type) => { addBlock(x,y,z,type); rebuildWorldMesh(); },
        blockCount: () => blocks.size
      };\n`;
      if (!html.includes(marker)) throw new Error('Debug injection point not found');
      html = html.replace(marker, injected + marker);
      await route.fulfill({ response, body: html });
    });

    await page.goto(process.env.GAME_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.screenshot({ path: 'test-results/start-screen.png' });
    check('WebGL available', await page.evaluate(() => {
      const c=document.createElement('canvas'); return !!(c.getContext('webgl2')||c.getContext('webgl'));
    }));
    await page.locator('#play').click();
    await page.waitForFunction(() => !!window.__voxelDebug, null, { timeout: 15000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'test-results/after-start.png', fullPage: true });

    let state = await page.evaluate(() => window.__voxelDebug.state());
    const spawnFloor = await page.evaluate(s => window.__voxelDebug.floor(s.x,s.z,s.feet), state);
    check('Spawn is standing on terrain', Number.isFinite(spawnFloor) && Math.abs(state.feet-spawnFloor)<0.08,
      JSON.stringify({ feet:state.feet, floor:spawnFloor, position:[state.x,state.y,state.z] }));

    // Test keyboard movement on level ground, away from the map edge.
    await page.evaluate(() => window.__voxelDebug.setPlayer(0, 10, window.__voxelDebug.floor(0,10,3.5)));
    const beforeMove = await page.evaluate(() => window.__voxelDebug.state());
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(900);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(250);
    const afterMove = await page.evaluate(() => window.__voxelDebug.state());
    check('Forward movement changes position', Math.hypot(afterMove.x-beforeMove.x, afterMove.z-beforeMove.z)>0.8,
      JSON.stringify({ from:[beforeMove.x,beforeMove.z], to:[afterMove.x,afterMove.z] }));

    // Test that jump rises and then returns to the same support surface.
    await page.evaluate(() => window.__voxelDebug.setPlayer(0,10,window.__voxelDebug.floor(0,10,3.5)));
    const jumpStart = await page.evaluate(() => window.__voxelDebug.state());
    await page.locator('#jump').dispatchEvent('pointerdown', { pointerId: 77, pointerType: 'touch', isPrimary: true, button: 0 });
    await page.waitForTimeout(80);
    await page.waitForTimeout(200);
    const jumpApex = await page.evaluate(() => window.__voxelDebug.state());
    await page.waitForTimeout(1200);
    const jumpLand = await page.evaluate(() => window.__voxelDebug.state());
    check('Jump produces upward motion', jumpApex.feet > jumpStart.feet+0.35,
      JSON.stringify({ start:jumpStart.feet, apexSample:jumpApex.feet }));
    check('Jump lands back on ground', jumpLand.onGround && Math.abs(jumpLand.feet-jumpStart.feet)<0.12,
      JSON.stringify({ start:jumpStart.feet, landed:jumpLand.feet, onGround:jumpLand.onGround }));

    // Place a solid wall immediately ahead and verify the hitbox cannot cross it.
    await page.evaluate(() => {
      const floor=window.__voxelDebug.floor(0,10,3.5);
      window.__voxelDebug.setPlayer(0,10,floor);
      // yaw=0 faces toward negative Z; wall spans the player's full body.
      const wallBase=Math.round(floor-0.5)+1;
      window.__voxelDebug.addBlock(0, wallBase, 8, 'stone');
      window.__voxelDebug.addBlock(0, wallBase+1, 8, 'stone');
    });
    const wallStart = await page.evaluate(() => window.__voxelDebug.state());
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1800);
    await page.keyboard.up('KeyW');
    const wallEnd = await page.evaluate(() => window.__voxelDebug.state());
    check('Player does not pass through a solid wall', wallEnd.z > 8.65 && wallEnd.z < wallStart.z,
      JSON.stringify({ startZ:wallStart.z, endZ:wallEnd.z, wallZ:8 }));

    // Touch joystick should move, then release cleanly.
    await page.evaluate(() => window.__voxelDebug.setPlayer(0,10,window.__voxelDebug.floor(0,10,3.5)));
    const pad = await page.locator('#pad').boundingBox();
    await page.mouse.move(pad.x+pad.width/2, pad.y+pad.height/2);
    await page.mouse.down();
    await page.mouse.move(pad.x+pad.width/2, pad.y+pad.height/2-40, { steps:4 });
    await page.waitForTimeout(700);
    await page.mouse.up();
    const touchState = await page.evaluate(() => window.__voxelDebug.state());
    check('Touch joystick moves the player', Math.hypot(touchState.x,touchState.z-10)>0.45,
      JSON.stringify({ x:touchState.x, z:touchState.z }));
    await page.waitForTimeout(100);
    check('No uncaught JavaScript errors', errors.length===0, JSON.stringify(errors));

    fs.writeFileSync('test-results/report.json', JSON.stringify({ results, errors }, null, 2));
    await page.screenshot({ path: 'test-results/final-state.png', fullPage: true });
  } catch (error) {
    fs.writeFileSync('test-results/report.json', JSON.stringify({ results, errors, fatal:error.message }, null, 2));
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
