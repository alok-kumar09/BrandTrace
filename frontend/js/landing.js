document.addEventListener("DOMContentLoaded", () => {
  // Hero lint test widget
  const input = document.getElementById("hero-test-input");
  const btn = document.getElementById("hero-test-btn");
  const result = document.getElementById("hero-test-result");

  function runTest() {
    if (!input || !result) return;
    const val = input.value.toLowerCase();
    const violations = [];
    if (val.includes("cheapest")) violations.push("“cheapest” (Restricted Price Superlative)");
    if (val.includes("guaranteed")) violations.push("“guaranteed” (Unverified Legal Risk)");

    if (violations.length > 0) {
      result.innerHTML = `<div class="test-result-fail">❌ Found ${violations.length} violation(s): ${violations.join(", ")}</div>`;
    } else {
      result.innerHTML = `<div class="test-result-success">✔ Copy looks clean and fully compliant with active rules!</div>`;
    }
  }

  if (btn) btn.addEventListener("click", runTest);
  if (input) input.addEventListener("keydown", e => { if (e.key === "Enter") runTest(); });
  runTest();

  // Feature Carousel Slider Logic
  const track = document.getElementById("feature-carousel");
  const dots = document.querySelectorAll(".carousel-dot");
  let currentSlide = 0;

  function goToSlide(n) {
    currentSlide = n;
    if (!track) return;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle("active", i === currentSlide));
  }

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => goToSlide(index));
  });

  if (track && dots.length) {
    setInterval(() => {
      currentSlide = (currentSlide + 1) % dots.length;
      goToSlide(currentSlide);
    }, 5000);
  }
});




  // Hero Text Slider Logic
  document.addEventListener("DOMContentLoaded", () => {
  // Hero Text Slider Logic
  const heroSlides = document.querySelectorAll(".hero-slide");
  const heroDots = document.querySelectorAll(".hero-dot");
  let currentHeroSlide = 0;
  let heroInterval;

  function showHeroSlide(index) {
    heroSlides.forEach((slide, i) => {
      if (i === index) {
        slide.hidden = false;
        slide.style.opacity = "0";
        setTimeout(() => slide.style.opacity = "1", 50);
      } else {
        slide.hidden = true;
      }
    });
    heroDots.forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });
    currentHeroSlide = index;
  }

  heroDots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      showHeroSlide(index);
      clearInterval(heroInterval);
      startHeroAutoPlay();
    });
  });

  function startHeroAutoPlay() {
    heroInterval = setInterval(() => {
      currentHeroSlide = (currentHeroSlide + 1) % heroSlides.length;
      showHeroSlide(currentHeroSlide);
    }, 4500);
  }

  if (heroSlides.length > 0) {
    startHeroAutoPlay();
  }
});