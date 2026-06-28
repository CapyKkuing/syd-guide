function currentPageName() {
  var path = window.location.pathname.split(/[\\/]/).pop() || "index.html";
  if (path.toLowerCase() === "sydney_route.html") return "index.html";
  return path.toLowerCase();
}

function markActiveNav() {
  var page = currentPageName();

  document.querySelectorAll("[data-page]").forEach(function (link) {
    var isActive = link.getAttribute("data-page") === page;
    link.classList.toggle("active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  document.querySelectorAll(".quick-nav").forEach(function (nav) {
    if (!nav.hasAttribute("aria-label")) {
      nav.setAttribute("aria-label", "빠른 메뉴");
    }
  });
}

function initFilters() {
  var filterBars = document.querySelectorAll(".filter-bar");
  if (!filterBars.length) return;

  var keywordMap = {
    popular: ["한국인", "인기", "Bills", "Bornga", "Speedos", "The Grounds", "Black Star", "Mamak"],
    specialty: ["Single O", "Sample Coffee", "Edition Coffee", "Campos", "Reuben Hills", "Paramount Coffee Project"],
    bakery: ["Lune", "Black Star", "KOI", "Gelato Messina"],
    bondi: ["Bondi", "Speedos", "Porch and Parlour", "Bondi Icebergs"],
    cbd: ["CBD", "Town Hall", "QVB", "Paramount Coffee Project", "Darling"],
    surry: ["Surry Hills", "Reuben Hills", "Paramount Coffee Project", "Devon Cafe"],
    photo: ["The Grounds", "QVB", "Bondi", "Manly", "Opera House", "Harbour"]
  };

  function cardMatches(card, filter) {
    var category = card.getAttribute("data-category");
    var text = (card.textContent || "").toLowerCase();
    var keywords = keywordMap[filter] || [];

    return (
      filter === "all" ||
      category === filter ||
      keywords.some(function (word) {
        return text.indexOf(String(word).toLowerCase()) !== -1;
      })
    );
  }

  function syncCollectionDividers(scope) {
    scope.querySelectorAll(".collection-divider").forEach(function (divider) {
      var visibleCards = 0;
      var node = divider.nextElementSibling;

      while (node && !node.classList.contains("collection-divider")) {
        if (node.matches("[data-category]") && !node.classList.contains("is-hidden")) {
          visibleCards += 1;
        }
        node = node.nextElementSibling;
      }

      divider.hidden = visibleCards === 0;
      divider.classList.toggle("is-hidden", visibleCards === 0);
    });
  }

  filterBars.forEach(function (bar) {
    var buttons = Array.prototype.slice.call(bar.querySelectorAll("[data-filter]"));
    var scope = bar.closest(".section") || document;
    var cards = Array.prototype.slice.call(scope.querySelectorAll("[data-category]"));

    buttons.forEach(function (button) {
      button.type = "button";
      button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
    });

    bar.addEventListener("click", function (event) {
      var button = event.target.closest("[data-filter]");
      if (!button || !bar.contains(button)) return;

      var filter = button.getAttribute("data-filter");

      buttons.forEach(function (item) {
        var active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", active ? "true" : "false");
      });

      cards.forEach(function (card) {
        var show = cardMatches(card, filter);
        card.hidden = !show;
        card.classList.toggle("is-hidden", !show);
      });

      syncCollectionDividers(scope);
    });
  });
}

function initCurrency() {
  var amount = document.querySelector("#audAmount");
  var rate = document.querySelector("#audRate");
  var result = document.querySelector("#krwResult");
  var status = document.querySelector("#rateStatus");
  var refresh = document.querySelector("#refreshRate");

  if (!amount || !rate || !result) return;

  result.setAttribute("aria-live", "polite");
  if (status) {
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
  }

  function render() {
    var aud = Number(amount.value || 0);
    var krw = Number(rate.value || 0);
    var total = aud * krw;

    result.textContent =
      new Intl.NumberFormat("ko-KR", {
        maximumFractionDigits: 0
      }).format(total) + "원";
  }

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function fetchRate() {
    setStatus("환율 불러오는 중...");

    fetch("https://open.er-api.com/v6/latest/AUD")
      .then(function (response) {
        if (!response.ok) throw new Error("rate fetch failed");
        return response.json();
      })
      .then(function (data) {
        if (!data || data.result !== "success" || !data.rates || !data.rates.KRW) {
          throw new Error("missing KRW");
        }

        rate.value = Number(data.rates.KRW).toFixed(2);
        setStatus("open.er-api.com 기준 · " + (data.time_last_update_utc || "업데이트 시간 확인 필요"));
        render();
      })
      .catch(function () {
        setStatus("API 연결 실패. 직접 입력값으로 계산합니다.");
        render();
      });
  }

  amount.addEventListener("input", render);
  rate.addEventListener("input", render);

  if (refresh) {
    refresh.addEventListener("click", fetchRate);
  }

  fetchRate();
  render();
}

function initLiveTasks() {
  var list = document.querySelector("#taskList");
  var summary = document.querySelector("#taskSummary");
  var updated = document.querySelector("#taskUpdated");

  if (!list || !summary || !updated) return;

  function parseTasks(text) {
    var lines = text.split(/\r?\n/);
    var items = [];

    lines.forEach(function (line) {
      var match = line.match(/^(\s*)-\s+\[(x| )\]\s+(.*)$/i);
      if (!match) return;

      items.push({
        depth: Math.max(0, Math.floor((match[1].length || 0) / 2)),
        done: String(match[2]).toLowerCase() === "x",
        label: match[3]
      });
    });

    return items;
  }

  function render(items) {
    var doneCount = items.filter(function (item) {
      return item.done;
    }).length;

    summary.textContent = doneCount + "/" + items.length + " 완료";
    updated.textContent = "마지막 갱신: " + new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    list.replaceChildren();

    if (!items.length) {
      var empty = document.createElement("li");
      empty.className = "task-item pending";
      empty.textContent = "TASKS.md에서 체크박스 항목 못 찾음.";
      list.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "task-item " + (item.done ? "done" : "pending");

      var head = document.createElement("div");
      head.className = "task-head";

      var label = document.createElement("span");
      label.className = "task-label";
      label.textContent = item.label;
      label.style.paddingLeft = item.depth ? item.depth * 16 + "px" : "0";

      var state = document.createElement("span");
      state.className = "task-state";
      state.textContent = item.done ? "완료" : "대기";

      head.appendChild(label);
      head.appendChild(state);
      li.appendChild(head);

      if (item.depth > 0) {
        var indent = document.createElement("div");
        indent.className = "task-indent";
        indent.textContent = "하위 항목";
        li.appendChild(indent);
      }

      list.appendChild(li);
    });
  }

  function refresh() {
    fetch("TASKS.md", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("TASKS fetch failed");
        return response.text();
      })
      .then(function (text) {
        render(parseTasks(text));
      })
      .catch(function () {
        summary.textContent = "읽기 실패";
        updated.textContent = "TASKS.md 불러오기 실패";
        list.replaceChildren();

        var error = document.createElement("li");
        error.className = "task-item pending";
        error.textContent = "TASKS.md를 읽을 수 없음. http 서버로 열었는지 확인.";
        list.appendChild(error);
      });
  }

  refresh();
  window.setInterval(refresh, 5000);
}

document.addEventListener("DOMContentLoaded", function () {
  markActiveNav();
  initFilters();
  initCurrency();
  initLiveTasks();
});
