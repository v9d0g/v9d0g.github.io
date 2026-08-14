const svg = document.getElementById("graph");
const queueEl = document.getElementById("queue");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");
const runStateEl = document.getElementById("runState");
const startNodeEl = document.getElementById("startNode");
const speedEl = document.getElementById("speed");
const visitedCountEl = document.getElementById("visitedCount");
const distanceCountEl = document.getElementById("distanceCount");
const stepCountEl = document.getElementById("stepCount");
const quizResult = document.getElementById("quizResult");

const NODE_R = 25;

const baseGraph = {
  A: ["B", "C"],
  B: ["A", "D", "E"],
  C: ["A", "F", "G"],
  D: ["B", "H"],
  E: ["B", "H", "I"],
  F: ["C", "I"],
  G: ["C", "J"],
  H: ["D", "E", "K"],
  I: ["E", "F", "K"],
  J: ["G", "K"],
  K: ["H", "I", "J"]
};

const positions = {
  A: [100, 260],
  B: [260, 150],
  C: [260, 370],
  D: [430, 90],
  E: [430, 210],
  F: [430, 330],
  G: [430, 450],
  H: [620, 120],
  I: [620, 260],
  J: [620, 410],
  K: [800, 260]
};

let graph = cloneGraph(baseGraph);
let state = {};
let bfs = null;
let timer = null;
let running = false;

function cloneGraph(g) {
  return Object.fromEntries(
    Object.entries(g).map(([k, v]) => [k, [...v]])
  );
}

function initializeState(start = "A") {
  stopTimer();

  bfs = {
    queue: [start],
    visited: new Set([start]),
    distance: { [start]: 0 },
    parent: {},
    current: null,
    neighborIndex: 0,
    phase: "dequeue",
    done: false,
    steps: 0
  };

  state = {};

  Object.keys(graph).forEach(n => {
    state[n] = "unvisited";
  });

  state[start] = "queued";

  logEl.innerHTML = "";

  runStateEl.textContent = "已初始化";

  addLog(
    `起点 <b>${start}</b> 入队，distance[${start}] = 0。`
  );

  render();
  updateUI();
}

function getEdges() {
  const edges = [];
  const seen = new Set();

  for (const [u, neighbors] of Object.entries(graph)) {
    for (const v of neighbors) {
      const key = [u, v].sort().join("-");

      if (!seen.has(key)) {
        seen.add(key);
        edges.push([u, v]);
      }
    }
  }

  return edges;
}

function render() {
  svg.innerHTML = "";

  const edgeLayer =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );

  const treeLayer =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );

  const nodeLayer =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );

  // 普通边
  getEdges().forEach(([u, v]) => {
    const [x1, y1] = positions[u];
    const [x2, y2] = positions[v];

    const line =
      document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );

    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", "#cbd5e1");
    line.setAttribute("stroke-width", "3");

    edgeLayer.appendChild(line);
  });

  // BFS 生成树
  Object.entries(bfs?.parent || {}).forEach(
    ([child, parent]) => {
      const [x1, y1] = positions[parent];
      const [x2, y2] = positions[child];

      const line =
        document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );

      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);

      line.setAttribute("stroke", "#2563eb");
      line.setAttribute("stroke-width", "8");
      line.setAttribute("stroke-linecap", "round");

      treeLayer.appendChild(line);
    }
  );

  // 节点
  Object.keys(graph).forEach(n => {
    const [x, y] = positions[n];

    const g =
      document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g"
      );

    g.classList.add("node");

    const circle =
      document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );

    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", NODE_R);

    const styles = {
      unvisited: ["#ffffff", "#9ca3af", "3"],
      queued: ["#fef3c7", "#f59e0b", "4"],
      current: ["#ede9fe", "#8b5cf6", "5"],
      visited: ["#d1fae5", "#10b981", "4"]
    };

    const currentStatus =
      state[n] || "unvisited";

    const [fill, stroke, width] =
      styles[currentStatus];

    circle.setAttribute("fill", fill);
    circle.setAttribute("stroke", stroke);
    circle.setAttribute("stroke-width", width);

    if (bfs?.current === n) {
      circle.setAttribute(
        "stroke-dasharray",
        "6 4"
      );
    }

    g.appendChild(circle);

    // 节点名称
    const text =
      document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );

    text.setAttribute("x", x);
    text.setAttribute("y", y + 7);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "17");
    text.setAttribute("font-weight", "700");
    text.setAttribute("fill", "#172033");

    text.textContent = n;

    g.appendChild(text);

    // 距离
    if (bfs?.distance[n] !== undefined) {
      const distance =
        document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text"
        );

      distance.setAttribute("x", x);
      distance.setAttribute("y", y + 45);
      distance.setAttribute(
        "text-anchor",
        "middle"
      );
      distance.setAttribute(
        "font-size",
        "12"
      );
      distance.setAttribute(
        "fill",
        "#667085"
      );

      distance.textContent =
        `d=${bfs.distance[n]}`;

      g.appendChild(distance);
    }

    // 点击节点切换 BFS 起点
    g.addEventListener("click", () => {
      startNodeEl.value = n;
      initializeState(n);
    });

    nodeLayer.appendChild(g);
  });

  svg.appendChild(edgeLayer);
  svg.appendChild(treeLayer);
  svg.appendChild(nodeLayer);
}

function updateUI() {
  queueEl.innerHTML = "";

  if (!bfs || bfs.queue.length === 0) {
    queueEl.innerHTML =
      '<span class="queue-empty">队列为空</span>';
  } else {
    bfs.queue.forEach(n => {
      const item =
        document.createElement("div");

      item.className = "queue-item";
      item.textContent = n;

      queueEl.appendChild(item);
    });
  }

  visitedCountEl.textContent =
    bfs ? bfs.visited.size : 0;

  const currentDistance =
    bfs?.current &&
    bfs.distance[bfs.current] !== undefined
      ? bfs.distance[bfs.current]
      : "—";

  distanceCountEl.textContent =
    currentDistance;

  stepCountEl.textContent =
    bfs?.steps ?? 0;

  if (!bfs) return;

  if (bfs.done) {
    runStateEl.textContent = "完成";

    statusEl.innerHTML =
      "<strong>BFS 完成。</strong><br>" +
      "所有从起点可达的节点都已经被访问。" +
      "蓝色边构成 BFS 生成树。";

    return;
  }

  if (bfs.current) {
    const neighbor =
      graph[bfs.current]?.[
        bfs.neighborIndex
      ];

    if (neighbor) {
      statusEl.innerHTML =
        `<strong>当前处理 ${bfs.current}。</strong><br>` +
        `正在检查邻居 <b>${neighbor}</b>。` +
        `如果它没有访问过，就把它标记为已访问并入队。`;
    } else {
      statusEl.innerHTML =
        `<strong>当前处理 ${bfs.current}。</strong><br>` +
        "它的所有邻居已经检查完毕，" +
        "可以从队列中继续处理下一个节点。";
    }
  }
}

function addLog(message) {
  const div =
    document.createElement("div");

  div.className = "log-item";
  div.innerHTML = message;

  logEl.prepend(div);
}

function step() {
  if (!bfs || bfs.done) {
    return;
  }

  bfs.steps++;

  /*
   * 第一阶段：
   * 从 Queue 中取出一个节点
   */
  if (bfs.phase === "dequeue") {
    if (bfs.queue.length === 0) {
      bfs.done = true;

      stopTimer();

      addLog(
        "<b>队列为空。</b> BFS 结束。"
      );

      render();
      updateUI();

      return;
    }

    const u = bfs.queue.shift();

    bfs.current = u;
    bfs.neighborIndex = 0;

    state[u] = "current";

    bfs.phase = "scan";

    addLog(
      `出队 <b>${u}</b>。现在扫描它的邻居。`
    );

    render();
    updateUI();

    return;
  }

  /*
   * 第二阶段：
   * 每一步只检查一个邻居
   */
  const u = bfs.current;
  const neighbors = graph[u];

  if (
    bfs.neighborIndex >=
    neighbors.length
  ) {
    state[u] = "visited";

    addLog(
      `<b>${u}</b> 的邻居检查完毕，标记为已处理。`
    );

    bfs.current = null;
    bfs.phase = "dequeue";

    render();
    updateUI();

    return;
  }

  const v =
    neighbors[bfs.neighborIndex++];

  if (!bfs.visited.has(v)) {
    bfs.visited.add(v);

    bfs.distance[v] =
      bfs.distance[u] + 1;

    bfs.parent[v] = u;

    bfs.queue.push(v);

    state[v] = "queued";

    addLog(
      `发现 <b>${v}</b>：` +
      `distance[${v}] = ` +
      `distance[${u}] + 1 = ` +
      `<b>${bfs.distance[v]}</b>，` +
      `并将 <b>${v}</b> 入队。`
    );
  } else {
    addLog(
      `检查邻居 <b>${v}</b>：` +
      "它已经被访问，跳过。"
    );
  }

  render();
  updateUI();
}

function start() {
  if (!bfs || bfs.done || running) {
    return;
  }

  running = true;
  runStateEl.textContent = "运行中";

  timer = setInterval(() => {
    if (!bfs || bfs.done) {
      stopTimer();
      return;
    }

    step();
  }, Number(speedEl.value));
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
  }

  timer = null;
  running = false;

  if (bfs?.done) {
    runStateEl.textContent = "完成";
  } else if (bfs) {
    runStateEl.textContent = "已暂停";
  }
}

function randomGraph() {
  const nodes = Object.keys(baseGraph);

  const g =
    Object.fromEntries(
      nodes.map(n => [n, []])
    );

  /*
   * 先随机生成一棵生成树，
   * 保证所有节点连通
   */
  const shuffled =
    [...nodes].sort(
      () => Math.random() - 0.5
    );

  for (
    let i = 1;
    i < shuffled.length;
    i++
  ) {
    const u = shuffled[i];

    const v =
      shuffled[
        Math.floor(Math.random() * i)
      ];

    g[u].push(v);
    g[v].push(u);
  }

  /*
   * 再随机添加一些边
   */
  const possible = [];

  for (
    let i = 0;
    i < nodes.length;
    i++
  ) {
    for (
      let j = i + 1;
      j < nodes.length;
      j++
    ) {
      const u = nodes[i];
      const v = nodes[j];

      if (!g[u].includes(v)) {
        possible.push([u, v]);
      }
    }
  }

  possible.sort(
    () => Math.random() - 0.5
  );

  possible
    .slice(0, 5)
    .forEach(([u, v]) => {
      g[u].push(v);
      g[v].push(u);
    });

  Object.values(g).forEach(arr =>
    arr.sort()
  );

  graph = g;

  initializeState(
    startNodeEl.value || "A"
  );

  addLog(
    "<b>已生成随机无向图。</b>"
  );
}

function populateStartNodes() {
  startNodeEl.innerHTML = "";

  Object.keys(graph).forEach(n => {
    const option =
      document.createElement("option");

    option.value = n;
    option.textContent =
      `节点 ${n}`;

    startNodeEl.appendChild(option);
  });
}


/* =========================
   按钮事件
   ========================= */

document
  .getElementById("startBtn")
  .addEventListener(
    "click",
    start
  );

document
  .getElementById("stepBtn")
  .addEventListener(
    "click",
    () => {
      stopTimer();
      step();
    }
  );

document
  .getElementById("pauseBtn")
  .addEventListener(
    "click",
    stopTimer
  );

document
  .getElementById("resetBtn")
  .addEventListener(
    "click",
    () => {
      initializeState(
        startNodeEl.value
      );
    }
  );

document
  .getElementById("randomBtn")
  .addEventListener(
    "click",
    randomGraph
  );

startNodeEl.addEventListener(
  "change",
  e => {
    initializeState(
      e.target.value
    );
  }
);

speedEl.addEventListener(
  "change",
  () => {
    if (running) {
      stopTimer();
      start();
    }
  }
);


/* =========================
   BFS 小测验
   ========================= */

document
  .querySelectorAll(
    ".quiz-options button"
  )
  .forEach(btn => {
    btn.addEventListener(
      "click",
      () => {
        if (
          btn.dataset.answer === "b"
        ) {
          quizResult.innerHTML =
            '<span style="color:#059669;">' +
            '<b>正确。</b> FIFO 队列使 BFS 按距离层次扩展，' +
            '因此节点第一次被发现时，其距离就是最短无权距离。' +
            '</span>';
        } else {
          quizResult.innerHTML =
            '<span style="color:#dc2626;">' +
            '<b>不正确。</b> 关键不是节点编号，' +
            '也不是反复修改，而是 FIFO 队列保证按层次扩展。' +
            '</span>';
        }
      }
    );
  });


/* =========================
   初始化
   ========================= */

populateStartNodes();
initializeState("A");