// 維持同一份頁面內容，切換主持區塊時保留計時器和勾選狀態。
(() => {
  const sections = [...document.querySelectorAll("[data-present-section]")];
  const sectionLinks = document.querySelectorAll("[data-section-link]");
  const navLinks = document.querySelectorAll("[data-nav-link]");
  const toggle = document.querySelector("[data-present-toggle]");
  const toggleLabel = document.querySelector("[data-present-label]");
  const bar = document.querySelector("[data-present-bar]");
  const title = document.querySelector("[data-present-title]");
  const previous = document.querySelector("[data-present-prev]");
  const next = document.querySelector("[data-present-next]");
  const header = document.querySelector(".site-header");

  let presenting = false;
  let currentIndex = 0;

  function routeIndex() {
    const index = sections.findIndex((section) => `#${section.id}` === location.hash);
    return index < 0 ? 0 : index;
  }

  function sectionHeading(section) {
    return document.getElementById(section.getAttribute("aria-labelledby"));
  }

  function renderSection(index) {
    currentIndex = index;
    const current = sections[index];

    sections.forEach((section) => {
      section.hidden = presenting && section !== current;
    });
    navLinks.forEach((link) => {
      if (link.hash === `#${current.id}`) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
    previous.disabled = index === 0;
    next.disabled = index === sections.length - 1;

    if (presenting) {
      const name = index === 0 ? "首頁" : sectionHeading(current).textContent;
      title.textContent = `${index + 1}／${sections.length}　${name}`;
    }
  }

  function scrollToSection(index) {
    if (presenting || index === 0) {
      window.scrollTo({ top: 0 });
    } else {
      sections[index].scrollIntoView({ block: "start" });
    }
  }

  function goTo(index) {
    if (index < 0 || index >= sections.length) return;
    const section = sections[index];
    const hash = `#${section.id}`;

    if (hash !== location.hash) history.pushState(null, "", hash);
    renderSection(index);
    sectionHeading(section).focus({ preventScroll: true });
    scrollToSection(index);
  }

  function sectionInView() {
    const nearTop = header.getBoundingClientRect().bottom + 90;
    return sections.reduce((index, section, candidate) => {
      return section.getBoundingClientRect().top <= nearTop ? candidate : index;
    }, 0);
  }

  function setPresenting(active) {
    const index = active ? sectionInView() : currentIndex;
    presenting = active;
    document.documentElement.classList.toggle("is-presenting", active);
    bar.hidden = !active;
    toggle.setAttribute("aria-pressed", String(active));
    toggleLabel.textContent = active ? "退出主持模式" : "主持模式";

    if (active && index !== routeIndex()) {
      history.replaceState(null, "", `#${sections[index].id}`);
    }
    renderSection(index);
    scrollToSection(index);
  }

  sectionLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const index = sections.findIndex((section) => `#${section.id}` === link.hash);
      if (index < 0) return;

      event.preventDefault();
      goTo(index);
    });
  });

  function syncHistory() {
    renderSection(routeIndex());

    if (presenting) {
      const agenda = location.hash === "#agenda" && document.getElementById("agenda");
      if (agenda) {
        agenda.scrollIntoView({ block: "start" });
      } else {
        scrollToSection(currentIndex);
      }
    }
  }

  window.addEventListener("popstate", syncHistory);
  window.addEventListener("hashchange", syncHistory);
  toggle.addEventListener("click", () => setPresenting(!presenting));
  previous.addEventListener("click", () => goTo(currentIndex - 1));
  next.addEventListener("click", () => goTo(currentIndex + 1));

  document.addEventListener("keydown", (event) => {
    if (!presenting || event.defaultPrevented) return;
    if (event.key === "Escape") {
      setPresenting(false);
      toggle.focus();
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target.closest("input, button, [contenteditable], audio, video")) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(currentIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(currentIndex + 1);
    }
  });

  renderSection(routeIndex());
})();
(() => {
  const countdown = document.querySelector("[data-countdown]");
  if (!countdown) return;

  const phaseButtons = [...countdown.querySelectorAll("[data-timer-phase]")];
  const stage = countdown.querySelector("[data-timer-stage]");
  const display = countdown.querySelector("[data-timer-display]");
  const startButton = countdown.querySelector("[data-timer-start]");
  const pauseButton = countdown.querySelector("[data-timer-pause]");
  const resetButton = countdown.querySelector("[data-timer-reset]");
  const status = countdown.querySelector("[data-timer-status]");
  const progress = countdown.querySelector("[data-timer-progress]");
  let activePhase;
  let duration = 0;
  let remaining = 0;
  let deadline = null;
  let interval = null;

  display.setAttribute("role", "timer");
  display.setAttribute("aria-live", "off");
  status.setAttribute("role", "status");

  function renderTime() {
    const seconds = Math.ceil(remaining / 1000);
    const minutesText = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secondsText = String(seconds % 60).padStart(2, "0");
    const time = `${minutesText}:${secondsText}`;
    if (display.textContent !== time) display.textContent = time;
    if (progress.value !== seconds) progress.value = seconds;
  }

  function setStatus(state, message) {
    countdown.dataset.timerState = state;
    status.textContent = message;
    const running = state === "running";
    startButton.textContent = state === "paused" ? "繼續" : "開始";
    startButton.setAttribute("aria-disabled", String(running));
    pauseButton.setAttribute("aria-disabled", String(!running));
  }

  function stopClock() {
    deadline = null;
    window.clearInterval(interval);
    interval = null;
  }

  // 用截止時間計算剩餘秒數，避免背景分頁節流導致倒數變慢。
  function refreshClock() {
    if (deadline === null) return;
    remaining = Math.min(duration, Math.max(0, deadline - Date.now()));
    renderTime();
    if (remaining === 0) {
      stopClock();
      setStatus("finished", "時間到");
    }
  }

  function selectPhase(button) {
    if (button === activePhase) return;
    stopClock();
    activePhase = button;
    duration = Number(button.dataset.seconds) * 1000;
    remaining = duration;
    stage.textContent = button.dataset.stageName;
    progress.max = duration / 1000;
    for (const phaseButton of phaseButtons) {
      phaseButton.setAttribute("aria-pressed", String(phaseButton === activePhase));
    }
    renderTime();
    setStatus("ready", "準備開始");
  }

  startButton.addEventListener("click", () => {
    if (deadline !== null) return;
    if (remaining === 0) remaining = duration;
    deadline = Date.now() + remaining;
    interval = window.setInterval(refreshClock, 200);
    renderTime();
    setStatus("running", "計時中");
  });

  pauseButton.addEventListener("click", () => {
    refreshClock();
    if (deadline === null) return;
    stopClock();
    setStatus("paused", "已暫停");
  });

  resetButton.addEventListener("click", () => {
    stopClock();
    remaining = duration;
    renderTime();
    setStatus("ready", "已重設，準備開始");
  });

  for (const button of phaseButtons) {
    button.addEventListener("click", () => selectPhase(button));
  }
  document.addEventListener("visibilitychange", refreshClock);
  window.addEventListener("pageshow", refreshClock);
  selectPhase(phaseButtons[0]);
})();
(() => {
  "use strict";

  const config = window.PLAB_CONFIG || {};

  function cleanText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function parseURL(value, base) {
    const text = cleanText(value);
    if (!text) return null;

    try {
      const url = new URL(text, base);
      return url.username || url.password ? null : url;
    } catch {
      return null;
    }
  }

  function localOrWebMedia(value) {
    const url = parseURL(value, document.baseURI);
    if (!url) return null;
    if (url.protocol === "https:" || url.protocol === "http:") return url;
    if (url.protocol === "file:" && window.location.protocol === "file:") return url;
    return null;
  }

  function mediaNote(placeholder, message) {
    const note = placeholder.querySelector("span");
    if (note) note.textContent = message;
  }

  function showEventPhotos() {
    const frame = document.querySelector("[data-event-photo]");
    const placeholder = frame?.querySelector(".media-placeholder");
    if (!placeholder || !Array.isArray(config.eventPhotos) || !config.eventPhotos.length) return;

    const gallery = document.createElement("div");
    gallery.className = "photo-gallery";

    const photos = config.eventPhotos
      .map((photo) => ({ source: localOrWebMedia(photo?.src), alt: cleanText(photo?.alt) }))
      .filter((photo) => photo.source);
    if (!photos.length) {
      mediaNote(placeholder, "照片路徑待確認。");
      return;
    }

    const images = photos.map(() => new Image());
    let failures = 0;
    photos.forEach((photo, index) => {
      const image = images[index];
      image.alt = photo.alt || "毛根花手作活動照片";
      image.decoding = "async";

      // 照片成功載入才替換佔位畫面，並維持設定檔中的排列順序。
      image.addEventListener("load", () => {
        if (!gallery.isConnected) placeholder.replaceWith(gallery);
        const nextImage = images.slice(index + 1).find((item) => item.parentNode === gallery);
        gallery.insertBefore(image, nextImage || null);
      }, { once: true });

      image.addEventListener("error", () => {
        failures += 1;
        if (failures === photos.length) mediaNote(placeholder, "照片暫時無法載入。");
      }, { once: true });

      image.src = photo.source.href;
    });
  }

  function facebookVideoId(url) {
    if (url.protocol !== "https:" || !["facebook.com", "www.facebook.com", "m.facebook.com"].includes(url.hostname)) return "";

    const pathId = url.pathname.match(/^\/(?:reel|(?:[^/]+\/)?videos)\/(\d+)\/?$/)?.[1];
    if (pathId) return pathId;

    if (/^\/(?:watch(?:\/live)?|video\.php)\/?$/.test(url.pathname)) {
      const queryId = url.searchParams.get("v");
      if (/^\d+$/.test(queryId || "")) return queryId;
    }

    return "";
  }

  function isFacebookVideoLink(url) {
    if (url.protocol !== "https:") return false;
    if (url.hostname === "fb.watch") return /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
    if (!["facebook.com", "www.facebook.com", "m.facebook.com"].includes(url.hostname)) return false;

    return Boolean(facebookVideoId(url)) || /^\/share\/v\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
  }

  function facebookEmbedURL(url) {
    const videoId = facebookVideoId(url);
    if (!videoId) return null;

    const source = new URL("https://www.facebook.com/watch/");
    if (url.pathname.startsWith("/reel/")) {
      source.pathname = `/reel/${videoId}/`;
    } else {
      source.searchParams.set("v", videoId);
    }

    const player = new URL("https://www.facebook.com/plugins/video.php");
    player.searchParams.set("href", source.href);
    player.searchParams.set("show_text", "false");
    player.searchParams.set("locale", "zh_TW");
    return player.href;
  }

  function videoEmbedURL(url) {
    if (url.protocol !== "https:") return null;

    const host = url.hostname;
    const [, route, firstId, secondId] = url.pathname.split("/");
    const youtubeHosts = ["youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com"];
    if (host === "youtu.be" || youtubeHosts.includes(host)) {
      let videoId;
      if (host === "youtu.be") {
        videoId = route;
      } else if (route === "watch") {
        videoId = url.searchParams.get("v");
      } else if (["embed", "shorts", "live"].includes(route)) {
        videoId = firstId;
      }
      if (/^[A-Za-z0-9_-]{11}$/.test(videoId || "")) {
        return `https://www.youtube-nocookie.com/embed/${videoId}`;
      }
    }

    if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
      const videoId = route === "video" ? firstId : route;
      if (/^\d+$/.test(videoId || "")) {
        const embed = new URL(`https://player.vimeo.com/video/${videoId}`);
        const privateId = url.searchParams.get("h") || (route === "video" ? "" : firstId);
        if (/^[A-Za-z0-9]+$/.test(privateId || "")) embed.searchParams.set("h", privateId);
        return embed.href;
      }
    }

    if (host === "drive.google.com" && route === "file" && firstId === "d") {
      if (/^[A-Za-z0-9_-]+$/.test(secondId || "")) {
        return `https://drive.google.com/file/d/${secondId}/preview`;
      }
    }

    return facebookEmbedURL(url);
  }

  function facebookVideoLinks(url) {
    const links = document.createElement("div");
    links.className = "project-video-links";

    const link = document.createElement("a");
    link.className = "button button-outline";
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "在 Facebook 觀看影片";
    link.setAttribute("aria-label", "在 Facebook 觀看影片（另開分頁）");
    links.append(link);
    return links;
  }

  function showProjectVideo() {
    const frame = document.querySelector("[data-project-video]");
    const placeholder = frame?.querySelector(".media-placeholder");
    const setting = cleanText(config.projectVideoUrl);
    if (!placeholder || !setting) return;

    const url = localOrWebMedia(setting);
    const facebookLink = url && isFacebookVideoLink(url) ? url : null;
    // Facebook 分享短網址可供直接開啟，內嵌播放器則使用另外設定的公開影片網址。
    const canonicalFacebookURL = facebookLink && parseURL(config.projectVideoEmbedUrl);
    const embedURL = (canonicalFacebookURL && facebookEmbedURL(canonicalFacebookURL)) ||
      (url && videoEmbedURL(url));
    const title = "捷運臺北車站感官友善計畫紀錄影片";

    if (embedURL) {
      const player = document.createElement("iframe");
      player.className = "project-video";
      player.title = title;
      player.loading = "lazy";
      player.allow = "encrypted-media; fullscreen; picture-in-picture";
      player.allowFullscreen = true;
      player.referrerPolicy = "strict-origin-when-cross-origin";
      player.src = embedURL;
      placeholder.replaceWith(player);
      if (facebookLink) frame.append(facebookVideoLinks(facebookLink));
      return;
    }

    if (facebookLink) {
      placeholder.replaceWith(facebookVideoLinks(facebookLink));
      return;
    }

    if (url && /\.(mp4|webm)$/i.test(url.pathname)) {
      const player = document.createElement("video");
      player.className = "project-video";
      player.controls = true;
      player.playsInline = true;
      player.preload = "metadata";
      player.setAttribute("aria-label", title);
      player.addEventListener("error", () => {
        mediaNote(placeholder, "影片暫時無法載入。");
        player.replaceWith(placeholder);
      }, { once: true });
      player.src = url.href;
      placeholder.replaceWith(player);
      return;
    }

    mediaNote(placeholder, "影片網址待確認。");
  }

  function setupParticipationForm() {
    const link = document.querySelector("[data-participation-form]");
    const status = document.querySelector("[data-form-status]");
    const setting = cleanText(config.participationFormUrl);
    if (!link || !status || !setting) return;

    const url = parseURL(setting);
    const validShortLink = url?.hostname === "forms.gle" && /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
    const validForm = url?.hostname === "docs.google.com" &&
      /^\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?[A-Za-z0-9_-]+\/viewform\/?$/.test(url.pathname);

    if (url?.protocol !== "https:" || (!validShortLink && !validForm)) {
      status.textContent = "Google 表單填寫網址待確認。";
      return;
    }

    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.removeAttribute("aria-disabled");
    status.textContent = "在新分頁開啟 Google 表單。";
  }

  function setChristmasDetails() {
    const target = document.querySelector("[data-christmas-lead]");
    const value = cleanText(config.christmas?.lead);
    if (target && value) target.textContent = value;
  }

  showEventPhotos();
  showProjectVideo();
  setupParticipationForm();
  setChristmasDetails();
})();
