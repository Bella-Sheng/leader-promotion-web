const STORAGE_KEY = 'leader-promotion-review-v5';

const DEFAULT_DIMENSIONS = [
  '团队管理能力',
  '沟通协调能力',
  '技术能力',
  '问题解决能力',
  '责任心与担当'
];

let state = loadState();

const elements = {
  personName: document.getElementById('person-name'),
  addPersonBtn: document.getElementById('add-person-btn'),
  personList: document.getElementById('person-list'),
  dimensionName: document.getElementById('dimension-name'),
  addDimensionBtn: document.getElementById('add-dimension-btn'),
  dimensionList: document.getElementById('dimension-list'),
  scoreTable: document.getElementById('score-table'),
  resultList: document.getElementById('result-list'),
  statPersonCount: document.getElementById('stat-person-count'),
  statDimensionCount: document.getElementById('stat-dimension-count'),
  statMaxScore: document.getElementById('stat-max-score'),
  statAverageScore: document.getElementById('stat-average-score')
};

bindEvents();
render();

function bindEvents() {
  elements.addPersonBtn.addEventListener('click', () => {
    const name = elements.personName.value.trim();
    if (!name) {
      alert('请输入人员姓名');
      return;
    }

    state.people.push({
      id: createId(),
      name,
      scores: generateDefaultScores(state.dimensions)
    });

    elements.personName.value = '';
    saveState();
    render();
  });

  elements.addDimensionBtn.addEventListener('click', () => {
    const name = elements.dimensionName.value.trim();
    if (!name) {
      alert('请输入工作能力维度名称');
      return;
    }

    if (state.dimensions.some((dimension) => dimension.name === name)) {
      alert('该维度已存在');
      return;
    }

    const newDimension = { id: createId(), name, isDefault: false };
    state.dimensions.push(newDimension);

    state.people.forEach((person) => {
      person.scores = generateDefaultScores(state.dimensions);
    });

    elements.dimensionName.value = '';
    saveState();
    render();
  });
}

function render() {
  renderPeopleList();
  renderDimensionList();
  renderTable();
  renderStats();
  renderResultList();
}

function renderPeopleList() {
  if (!state.people.length) {
    elements.personList.innerHTML = '<li class="empty-state">暂无参评人员，至少需要 2 人。</li>';
    return;
  }

  elements.personList.innerHTML = state.people
    .map(
      (person) => `
        <li class="chip-item">
          <span>${escapeHtml(person.name)}</span>
          <button class="remove-btn" type="button" data-role="remove-person" data-id="${person.id}" aria-label="删除人员">×</button>
        </li>
      `
    )
    .join('');

  elements.personList.querySelectorAll('[data-role="remove-person"]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.id);
      state.people = state.people.filter((person) => person.id !== id);
      saveState();
      render();
    });
  });
}

function renderDimensionList() {
  elements.dimensionList.innerHTML = state.dimensions
    .map(
      (dimension) => `
        <li class="dimension-item">
          <span>${escapeHtml(dimension.name)}</span>
          <button class="remove-btn" type="button" data-role="remove-dimension" data-id="${dimension.id}" aria-label="删除维度">×</button>
        </li>
      `
    )
    .join('');

  elements.dimensionList.querySelectorAll('[data-role="edit-dimension"]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.id);
      const dimension = state.dimensions.find((item) => item.id === id);
      if (!dimension) return;

      const nextName = window.prompt('请输入新的能力维度名称', dimension.name)?.trim();
      if (!nextName || nextName === dimension.name) return;
      if (state.dimensions.some((item) => item.id !== id && item.name === nextName)) {
        alert('该维度已存在');
        return;
      }

      dimension.name = nextName;
      saveState();
      render();
    });
  });

  elements.dimensionList.querySelectorAll('[data-role="remove-dimension"]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.id);
      const dimensionExists = state.dimensions.find((dimension) => dimension.id === id);
      if (!dimensionExists) {
        return;
      }

      state.dimensions = state.dimensions.filter((dimension) => dimension.id !== id);
      state.people.forEach((person) => {
        person.scores = generateDefaultScores(state.dimensions);
      });

      saveState();
      render();
    });
  });
}

function renderTable() {
  const tableHead = ['姓名', ...state.dimensions.map((dimension) => dimension.name), '总分'];
  const headerHtml = tableHead
    .map((label) => `<th>${escapeHtml(label)}</th>`)
    .join('');

  if (!state.people.length || !state.dimensions.length) {
    elements.scoreTable.innerHTML = '<tbody><tr><td colspan="100%"><div class="empty-state">请至少添加 2 位参评人员和 1 个工作能力维度。</div></td></tr></tbody>';
    return;
  }

  const rowsHtml = state.people
    .map((person) => {
      const scoreInputs = state.dimensions
        .map((dimension) => {
          const score = Number(person.scores[dimension.id] ?? 0);
          return `
            <td>
              <input
                type="text"
                inputmode="decimal"
                maxlength="8"
                value="${score.toFixed(1)}"
                data-role="score-input"
                data-person-id="${person.id}"
                data-dimension-id="${dimension.id}"
              />
            </td>
          `;
        })
        .join('');

      const total = computePersonTotal(person);
      return `
        <tr>
          <td>${escapeHtml(person.name)}</td>
          ${scoreInputs}
          <td><span class="total-badge">${total.toFixed(1)}</span></td>
        </tr>
      `;
    })
    .join('');

  elements.scoreTable.innerHTML = `
    <thead>
      <tr>${headerHtml}</tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  `;

  elements.scoreTable.querySelectorAll('[data-role="score-input"]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const target = event.target;
      const personId = Number(target.dataset.personId);
      const dimensionId = Number(target.dataset.dimensionId);
      const person = state.people.find((item) => item.id === personId);
      if (!person) return;

      const newValue = clampScore(target.value, getScoreLimit());
      person.scores[dimensionId] = Number(newValue.toFixed(1));

      target.value = Number(person.scores[dimensionId]).toFixed(1);
      saveState();
      render();
    });
  });
}

function renderStats() {
  const personsCount = state.people.length;
  const dimensionsCount = state.dimensions.length;
  const averageScore = personsCount ? getOverallAverage() : 0;
  const maxScore = personsCount ? Math.max(...state.people.map((person) => computePersonTotal(person))) : 0;

  elements.statPersonCount.textContent = String(personsCount);
  elements.statDimensionCount.textContent = String(dimensionsCount);
  elements.statMaxScore.textContent = maxScore.toFixed(1);
  elements.statAverageScore.textContent = averageScore.toFixed(1);
}

function renderResultList() {
  if (state.people.length < 2) {
    elements.resultList.innerHTML = '<div class="empty-state">至少需要 2 名参评人员，才能生成晋升排行。</div>';
    return;
  }

  const ranking = [...state.people]
    .map((person) => ({
      ...person,
      total: computePersonTotal(person)
    }))
    .sort((a, b) => b.total - a.total);

  elements.resultList.innerHTML = ranking
    .map(
      (person, index) => `
        <div class="result-item">
          <div class="result-meta">
            <span class="result-rank">${index + 1}</span>
            <span>${escapeHtml(person.name)}</span>
          </div>
          <span class="result-score">${person.total.toFixed(1)} 分</span>
        </div>
      `
    )
    .join('');
}

function computePersonTotal(person) {
  return state.dimensions.reduce(
    (sum, dimension) => sum + Number(person.scores[dimension.id] ?? 0),
    0
  );
}

function getOverallAverage() {
  if (!state.people.length) return 0;
  const total = state.people.reduce((sum, person) => sum + computePersonTotal(person), 0);
  return total / state.people.length;
}

function getScoreLimit() {
  return state.dimensions.length ? 100 / state.dimensions.length : 0;
}

function clampScore(value, maximum = 100) {
  const number = Number(value);
  if (Number.isNaN(number)) return 0;
  return Math.min(maximum, Math.max(0, Number(number)));
}

function generateDefaultScores(dimensions) {
  if (!Array.isArray(dimensions) || !dimensions.length) return {};
  return Object.fromEntries(dimensions.map((dimension) => [dimension.id, 0]));
}

function createId() {
  return Date.now() + Math.random();
}

function loadState() {
  localStorage.removeItem(STORAGE_KEY);

  const dimensions = DEFAULT_DIMENSIONS.map((name, index) => ({
      id: createId() + index,
      name,
      isDefault: true
    }));

  return {
    people: [
      { id: createId(), name: '郝营', scores: generateDefaultScores(dimensions) },
      { id: createId(), name: '何贵宝', scores: generateDefaultScores(dimensions) }
    ],
    dimensions
  };
}

function saveState() {
  state.people = state.people.map((person) => ({
    ...person,
    scores: Object.fromEntries(
      Object.entries(person.scores || {}).map(([key, value]) => [Number(key), clampScore(value, getScoreLimit())])
    )
  }));
  state.people.forEach((person) => {
    state.dimensions.forEach((dimension) => {
      if (!Object.prototype.hasOwnProperty.call(person.scores, dimension.id)) {
        person.scores[dimension.id] = 0;
      }
    });
  });

}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.addEventListener('DOMContentLoaded', () => {
  if (!state.people.length) {
    state.people = [
      { id: createId(), name: '郝营', scores: generateDefaultScores(state.dimensions) },
      { id: createId(), name: '何贵宝', scores: generateDefaultScores(state.dimensions) }
    ];
  }

  if (!state.dimensions.length) {
    state.dimensions = DEFAULT_DIMENSIONS.map((name, index) => ({
      id: createId() + index,
      name,
      isDefault: true
    }));
  }

  state.people.forEach((person) => {
    person.scores = person.scores || {};
    state.dimensions.forEach((dimension) => {
      if (!(dimension.id in person.scores)) {
        person.scores[dimension.id] = 0;
      }
    });
  });

  saveState();
  render();
});
