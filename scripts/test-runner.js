import http from 'http';
import WebSocket from 'ws';

async function run() {
  const tabs = await new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/list', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const page = tabs.find(t => t.type === 'page' && t.url.includes('3005'));
  if (!page) {
    console.error('No page tab found at 3005');
    process.exit(1);
  }

  console.log('Connecting to', page.webSocketDebuggerUrl);
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
      return;
    }

    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      console.log(`[BROWSER CONSOLE ${msg.params.type.toUpperCase()}]`, args);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails);
    }
  });

  await new Promise(r => ws.on('open', r));
  await send('Runtime.enable');
  await send('Page.enable');

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  }

  console.log('Page loaded. Checking Phaser game...');
  let sceneName = await evaluate(`window.phaserGame ? window.phaserGame.scene.getScenes(true).map(s => s.scene.key).join(',') : 'no game'`);
  console.log('Active scenes:', sceneName);

  // Click on "CHƠI VỚI AI" (PvE)
  console.log('Triggering PvE button click in MenuScene...');
  await evaluate(`
    (() => {
      const game = window.phaserGame;
      const menu = game.scene.getScene('MenuScene');
      if (menu) {
        menu.scene.start('CommanderScene', { mode: 'PVE_AI' });
      }
    })()
  `);

  await new Promise(r => setTimeout(r, 600));
  sceneName = await evaluate(`window.phaserGame.scene.getScenes(true).map(s => s.scene.key).join(',')`);
  console.log('Active scenes after Menu:', sceneName);

  // In CommanderScene, select commander and go to DeployScene
  console.log('Selecting commander and going to DeployScene...');
  await evaluate(`
    (() => {
      const game = window.phaserGame;
      const cmd = game.scene.getScene('CommanderScene');
      if (cmd) {
        cmd.selectedCommanderId = 'SPLITTER';
        cmd.confirmSelection();
      }
    })()
  `);

  await new Promise(r => setTimeout(r, 600));
  sceneName = await evaluate(`window.phaserGame.scene.getScenes(true).map(s => s.scene.key).join(',')`);
  console.log('Active scenes after Commander:', sceneName);

  // In DeployScene, simulate rotating, auto-placing, clicking
  console.log('Testing DeployScene operations...');
  const deployLogs = await evaluate(`
    (() => {
      const game = window.phaserGame;
      const deploy = game.scene.getScene('DeployScene');
      if (!deploy) return 'No DeployScene';
      
      const results = [];
      // Test rotate unit
      try {
        deploy.rotateSelectedUnit();
        results.push('rotateSelectedUnit OK');
      } catch (e) {
        results.push('rotateSelectedUnit ERROR: ' + e.message + e.stack);
      }

      // Test buildUnitRosterUI
      try {
        deploy.buildUnitRosterUI();
        results.push('buildUnitRosterUI OK');
      } catch (e) {
        results.push('buildUnitRosterUI ERROR: ' + e.message + e.stack);
      }

      // Test autoPlace
      try {
        const { autoPlaceFleet } = deploy;
        deploy.autoPlaceFleet ? deploy.autoPlaceFleet() : null;
        // Trigger auto place button callback
        deploy.confirmDeployment ? null : null;
        results.push('Deploy check OK');
      } catch (e) {
        results.push('Auto place ERROR: ' + e.message);
      }

      return results.join('; ');
    })()
  `);
  console.log('Deploy test result:', deployLogs);

  // Now trigger auto place and confirm deployment to BattleScene!
  console.log('Auto placing and entering BattleScene...');
  await evaluate(`
    (() => {
      const game = window.phaserGame;
      const deploy = game.scene.getScene('DeployScene');
      if (deploy) {
        // Find auto place button or use autoPlaceFleet directly
        const { autoPlaceFleet } = deploy;
        // import is in file, but let's call the button logic
        deploy.board.units.forEach(u => u.placed = true); // force all placed or call confirm
        // Actually let's simulate the Ready button click
        // But first let's see what happens on actual ready
      }
    })()
  `);

  ws.close();
}

run().catch(console.error);

