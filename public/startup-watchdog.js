(function () {
  window.setTimeout(function () {
    var root = document.getElementById("root");
    var fallback = root && root.querySelector(":scope > .startup-fallback");
    if (!fallback) return;

    fallback.classList.add("startup-fallback--slow");

    var status = fallback.querySelector("[data-startup-status]");
    if (status) {
      status.textContent = "启动时间有点久，可以刷新或重新打开应用。";
    }

    if (!fallback.querySelector("small")) {
      var detail = document.createElement("small");
      detail.textContent = "如果刷新后仍停在这里，请重启当前开发服务或重新打开桌面应用。";
      fallback.appendChild(detail);
    }

    if (!fallback.querySelector("button")) {
      var reload = document.createElement("button");
      reload.type = "button";
      reload.textContent = "刷新";
      reload.addEventListener("click", function () {
        window.location.reload();
      });
      fallback.appendChild(reload);
    }
  }, 8000);
})();
