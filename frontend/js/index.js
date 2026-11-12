
document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // HERO TEXT AUDIT
  // ==========================================
  const input = document.getElementById("hero-test-input");
  const btn = document.getElementById("hero-test-btn");
  const result = document.getElementById("hero-test-result");

  const restrictedWords = [
    "cheapest", "guaranteed", "best", "fastest", "number one"
  ];

  let auditTimer;

  function runAudit() {
    if (!input || !result || !btn) return;

    const text = input.value.trim().toLowerCase();

    if (!text) {
      result.className = "micro-widget-result";
      result.textContent = "Please enter some copy to audit.";
      result.classList.add("test-result-fail", "result-visible");
      return;
    }

    clearTimeout(auditTimer);

    // Button feedback
    btn.classList.remove("audit-success", "audit-fail");
    btn.classList.add("audit-loading");
    btn.disabled = true;
    btn.innerHTML = '<span class="audit-spinner"></span> Scanning Copy...';

    // Hide previous result
    result.className = "micro-widget-result";
    result.textContent = "";

    // Simulate a short scanning process
    auditTimer = setTimeout(() => {
      const matched = restrictedWords.filter(word => {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`\\b${escaped}\\b`, "i").test(text);
      });

      const failed = matched.length > 0;

      // Display result
      result.className = "micro-widget-result";

      if (failed) {
        result.classList.add("test-result-fail");
        result.textContent =
          `⚠️ High Risk: Found ${matched.length} restricted term(s): ${matched.join(", ")}. Consider revising your copy.`;
      } else {
        result.classList.add("test-result-success");
        result.textContent =
          "✓ Clean Copy: No restricted terms detected by this demo audit.";
      }

      // Animate result
      requestAnimationFrame(() => {
        result.classList.add("result-visible");
      });

      // Button completion feedback
      btn.classList.remove("audit-loading");
      btn.classList.add(failed ? "audit-fail" : "audit-success");
      btn.innerHTML = failed
        ? "⚠ Issues Found"
        : "✓ Audit Complete";

      btn.disabled = false;

      // Restore original button after a delay
      setTimeout(() => {
        btn.classList.remove("audit-success", "audit-fail");
        btn.innerHTML = "Run Audit";
      }, 2200);

    }, 650);
  }

  if (btn) {
    btn.addEventListener("click", runAudit);
  }

  if (input) {
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        runAudit();
      }
    });

    input.addEventListener("input", () => {
      if (result) {
        result.className = "micro-widget-result";
        result.textContent = "";
      }
    });
  }

  // ==========================================
  // FEATURE CAROUSEL
  // ==========================================
  const track = document.getElementById("feature-carousel");
  const dots = document.querySelectorAll(".carousel-dot");
  let currentSlide = 0;
  let carouselInterval;

  function goToSlide(index) {
    if (!track || !dots.length) return;

    currentSlide = (index + dots.length) % dots.length;

    track.style.transform = `translateX(-${currentSlide * 100}%)`;

    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === currentSlide);
    });
  }

  if (track && dots.length) {
    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        goToSlide(index);
        clearInterval(carouselInterval);
        carouselInterval = setInterval(
          () => goToSlide(currentSlide + 1),
          5000
        );
      });
    });

    carouselInterval = setInterval(
      () => goToSlide(currentSlide + 1),
      5000
    );
  }

  // ==========================================
  // HERO TEXT SLIDER
  // ==========================================
  const heroSlides = document.querySelectorAll(".hero-slide");
  const heroDots = document.querySelectorAll(".hero-dot");

  let currentHeroSlide = 0;
  let heroInterval;

  function showHeroSlide(index) {
    if (!heroSlides.length) return;

    currentHeroSlide = (index + heroSlides.length) % heroSlides.length;

    heroSlides.forEach((slide, i) => {
      const active = i === currentHeroSlide;

      slide.hidden = !active;
      slide.style.opacity = active ? "1" : "0";
    });

    heroDots.forEach((dot, i) => {
      dot.classList.toggle("active", i === currentHeroSlide);
    });
  }

  function startHeroAutoPlay() {
    clearInterval(heroInterval);

    if (heroSlides.length < 2) return;

    heroInterval = setInterval(() => {
      showHeroSlide(currentHeroSlide + 1);
    }, 4500);
  }

  if (heroSlides.length) {
    showHeroSlide(0);
    startHeroAutoPlay();

    heroDots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        showHeroSlide(index);
        startHeroAutoPlay();
      });
    });
  }
});
