<template>
  <main class="home-page">
    <header class="home-nav">
      <RouterLink class="brand" to="/">
        <span class="brand-globe" aria-hidden="true"></span>
        <span class="brand-main">AI+GIS</span>
        <span class="brand-sub">城市低空经济空间平台</span>
      </RouterLink>
      <nav class="nav-links" aria-label="首页导航">
        <RouterLink to="/">首页</RouterLink>
        <RouterLink to="/overview">空间总览</RouterLink>
        <RouterLink to="/scene3d">三维城市</RouterLink>
        <RouterLink to="/vitality">经济活力</RouterLink>
        <RouterLink to="/lowaltitude">低空经济</RouterLink>
      </nav>
      <div class="account">
        <span class="avatar" aria-hidden="true"></span>
        <span>小组展示</span>
      </div>
    </header>

    <section class="hero" aria-labelledby="home-title">
      <div class="star-field" aria-hidden="true"></div>
      <div class="orbit-lines" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="hero-copy">
        <p class="eyebrow">融合低空经济、武汉智眼与 GIS 空间分析</p>
        <h1 id="home-title">AI+GIS 城市低空经济驱动的城市经济空间展示平台</h1>
        <p class="tagline">融合武汉智眼</p>
        <div class="hero-actions">
          <RouterLink class="primary-link" to="/overview">进入平台</RouterLink>
          <RouterLink class="secondary-link" to="/scene3d">查看三维场景</RouterLink>
        </div>
      </div>

      <div class="theme-visual" aria-hidden="true">
        <div class="city-board">
          <span class="scan-line"></span>
          <span class="hubei-outline"></span>
          <span class="flight-path path-a"></span>
          <span class="flight-path path-b"></span>
          <span class="uav-node node-a"></span>
          <span class="uav-node node-b"></span>
          <span class="heat heat-a"></span>
          <span class="heat heat-b"></span>
          <span class="heat heat-c"></span>
          <div class="skyline">
            <span class="tower tower-a"></span>
            <span class="tower tower-b"></span>
            <span class="tower tower-c"></span>
            <span class="tower tower-d"></span>
            <span class="tower tower-e"></span>
          </div>
        </div>
      </div>

      <aside class="team-panel" aria-label="小组成员">
        <span class="panel-label">TEAM</span>
        <h2>小组成员</h2>
        <div class="member-list">
          <span>施贞如</span>
          <span>李星靓</span>
        </div>
      </aside>
    </section>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  color: #eef7ff;
  background:
    linear-gradient(115deg, rgba(2, 5, 9, 0.98) 0 38%, rgba(4, 21, 34, 0.92) 58%, rgba(1, 8, 18, 0.98) 100%),
    radial-gradient(circle at 72% 45%, rgba(52, 211, 153, 0.18), transparent 24%),
    radial-gradient(circle at 86% 18%, rgba(56, 189, 248, 0.18), transparent 20%),
    radial-gradient(circle at 8% 8%, rgba(120, 205, 255, 0.16), transparent 20%),
    #020509;
}

.home-nav {
  position: relative;
  z-index: 5;
  height: 76px;
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 0 42px;
  background: rgba(0, 0, 0, 0.58);
  backdrop-filter: blur(12px);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
  color: #eaf6ff;
}

.brand-globe {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 30%, #f8fbff 0 6%, transparent 7%),
    radial-gradient(circle at 56% 48%, rgba(166, 226, 255, 0.92) 0 8%, transparent 9%),
    linear-gradient(135deg, #d9f3ff 0 10%, #4ca6d7 24%, #123c73 62%, #071326 100%);
  box-shadow: 0 0 18px rgba(129, 213, 255, 0.58);
}

.brand-main {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.brand-sub {
  margin-left: 2px;
  padding-left: 14px;
  border-left: 1px solid rgba(125, 216, 255, 0.42);
  font-size: 18px;
  font-weight: 700;
  color: #d7edff;
  white-space: nowrap;
}

.nav-links {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
  gap: clamp(18px, 3vw, 44px);
}

.nav-links a {
  color: rgba(238, 247, 255, 0.82);
  font-size: 15px;
  font-weight: 650;
  white-space: nowrap;
}

.nav-links a:hover,
.nav-links a.router-link-active {
  color: #7dd8ff;
}

.account {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  color: rgba(238, 247, 255, 0.68);
  font-size: 14px;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fff, #dbeafe 50%, #c4b5fd);
  box-shadow: 0 0 16px rgba(255, 255, 255, 0.38);
}

.hero {
  position: relative;
  min-height: calc(100vh - 76px);
  display: grid;
  grid-template-columns: minmax(360px, 0.95fr) minmax(420px, 1.05fr);
  align-items: center;
  padding: 30px clamp(28px, 8vw, 120px) 78px;
}

.theme-visual,
.city-board,
.scan-line,
.hubei-outline,
.orbit-lines,
.flight-path,
.uav-node,
.heat,
.skyline {
  pointer-events: none;
}

.star-field,
.star-field::before,
.star-field::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(125, 216, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(125, 216, 255, 0.06) 1px, transparent 1px),
    radial-gradient(circle, rgba(125, 216, 255, 0.48) 0 1px, transparent 1.8px);
  background-position:
    0 0,
    0 0,
    90px 120px;
  background-size:
    76px 76px,
    76px 76px,
    260px 220px;
  opacity: 0.26;
}

.star-field::before,
.star-field::after {
  content: '';
}

.star-field::before {
  transform: translateX(80px) scale(1.18);
  opacity: 0.12;
}

.star-field::after {
  transform: translateY(60px) scale(0.82);
  opacity: 0.16;
}

.orbit-lines {
  position: absolute;
  left: 6vw;
  top: 16vh;
  width: 42vw;
  height: 44vh;
  pointer-events: none;
  transform: rotate(-16deg);
  opacity: 0.34;
}

.orbit-lines span {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(185, 235, 255, 0.36), transparent);
}

.orbit-lines span:nth-child(1) {
  top: 18%;
}

.orbit-lines span:nth-child(2) {
  top: 38%;
  transform: translateX(48px);
}

.orbit-lines span:nth-child(3) {
  top: 58%;
  transform: translateX(96px);
}

.hero-copy {
  position: relative;
  z-index: 3;
  max-width: 650px;
}

.eyebrow {
  margin: 0 0 18px;
  color: #80d9ff;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

h1 {
  margin: 0;
  max-width: 760px;
  font-size: clamp(42px, 5vw, 76px);
  line-height: 1.18;
  font-weight: 850;
  letter-spacing: 0;
  color: #eef9ff;
  text-shadow:
    0 0 6px rgba(255, 255, 255, 0.85),
    0 0 32px rgba(112, 207, 255, 0.55);
}

.tagline {
  display: inline-flex;
  max-width: 100%;
  margin: 42px 0 0;
  padding: 9px 22px;
  border: 2px solid rgba(116, 220, 255, 0.78);
  border-radius: 999px;
  background: rgba(12, 21, 28, 0.72);
  color: #f0fbff;
  font-size: clamp(18px, 2vw, 27px);
  line-height: 1.25;
  box-shadow:
    inset 0 0 16px rgba(125, 216, 255, 0.16),
    0 0 18px rgba(125, 216, 255, 0.25);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 28px;
}

.primary-link,
.secondary-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 22px;
  border-radius: 6px;
  font-weight: 700;
}

.primary-link {
  color: #03111d;
  background: #8ee6ff;
  box-shadow: 0 0 22px rgba(125, 216, 255, 0.45);
}

.secondary-link {
  color: #e9f8ff;
  border: 1px solid rgba(142, 230, 255, 0.6);
  background: rgba(10, 22, 34, 0.74);
}

.theme-visual {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 560px;
}

.city-board {
  position: relative;
  width: min(50vw, 680px);
  aspect-ratio: 1.12;
  border-radius: 18px;
  overflow: hidden;
  background:
    linear-gradient(rgba(125, 216, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(125, 216, 255, 0.08) 1px, transparent 1px),
    radial-gradient(circle at 58% 43%, rgba(52, 211, 153, 0.16), transparent 30%),
    radial-gradient(circle at 38% 62%, rgba(251, 191, 36, 0.14), transparent 23%),
    linear-gradient(145deg, rgba(10, 23, 37, 0.86), rgba(4, 12, 22, 0.92));
  background-size:
    42px 42px,
    42px 42px,
    auto,
    auto,
    auto;
  border: 1px solid rgba(125, 216, 255, 0.24);
  box-shadow:
    inset 0 0 70px rgba(56, 189, 248, 0.08),
    0 0 36px rgba(56, 189, 248, 0.18),
    0 0 92px rgba(52, 211, 153, 0.1);
  transform: perspective(900px) rotateX(58deg) rotateZ(-9deg);
  transform-origin: 50% 68%;
}

.city-board::before {
  content: '';
  position: absolute;
  inset: 10% 12%;
  border: 2px solid rgba(56, 189, 248, 0.62);
  clip-path: polygon(
    46% 0,
    58% 8%,
    61% 21%,
    78% 25%,
    83% 38%,
    72% 48%,
    75% 62%,
    60% 76%,
    53% 100%,
    36% 92%,
    28% 75%,
    18% 67%,
    25% 49%,
    17% 36%,
    30% 23%,
    34% 9%
  );
  filter: drop-shadow(0 0 16px rgba(56, 189, 248, 0.55));
  opacity: 0.92;
}

.city-board::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0 44%, rgba(125, 216, 255, 0.22) 50%, transparent 56%);
  opacity: 0.18;
}

.scan-line {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 0 44%, rgba(125, 216, 255, 0.26) 50%, transparent 58%);
  opacity: 0.45;
}

.hubei-outline {
  position: absolute;
  inset: 10% 12%;
  background: rgba(56, 189, 248, 0.08);
  clip-path: polygon(
    46% 0,
    58% 8%,
    61% 21%,
    78% 25%,
    83% 38%,
    72% 48%,
    75% 62%,
    60% 76%,
    53% 100%,
    36% 92%,
    28% 75%,
    18% 67%,
    25% 49%,
    17% 36%,
    30% 23%,
    34% 9%
  );
}

.flight-path {
  position: absolute;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, #8ee6ff 18% 72%, transparent);
  box-shadow: 0 0 12px rgba(142, 230, 255, 0.62);
}

.path-a {
  left: 18%;
  top: 38%;
  width: 64%;
  transform: rotate(-18deg);
}

.path-b {
  left: 25%;
  top: 62%;
  width: 54%;
  transform: rotate(24deg);
}

.uav-node {
  position: absolute;
  width: 18px;
  height: 18px;
  border: 2px solid #dff8ff;
  border-radius: 50%;
  background: #8ee6ff;
  box-shadow:
    0 0 0 8px rgba(142, 230, 255, 0.12),
    0 0 18px rgba(142, 230, 255, 0.8);
}

.node-a {
  right: 22%;
  top: 30%;
}

.node-b {
  left: 28%;
  top: 66%;
}

.heat {
  position: absolute;
  width: 130px;
  height: 130px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.44), rgba(52, 211, 153, 0.16) 46%, transparent 70%);
  border: 1px solid rgba(251, 191, 36, 0.25);
}

.heat-a {
  left: 22%;
  top: 26%;
}

.heat-b {
  right: 20%;
  top: 48%;
}

.heat-c {
  left: 42%;
  bottom: 14%;
}

.skyline {
  position: absolute;
  left: 12%;
  right: 12%;
  bottom: 10%;
  height: 42%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 16px;
}

.tower {
  width: 48px;
  display: block;
  border: 1px solid rgba(125, 216, 255, 0.3);
  background:
    repeating-linear-gradient(180deg, rgba(238, 247, 255, 0.16) 0 4px, transparent 4px 16px),
    linear-gradient(180deg, rgba(56, 189, 248, 0.3), rgba(7, 22, 34, 0.72));
  box-shadow: 0 0 18px rgba(56, 189, 248, 0.12);
}

.tower-a {
  height: 42%;
}

.tower-b {
  height: 72%;
}

.tower-c {
  height: 54%;
}

.tower-d {
  height: 86%;
}

.tower-e {
  height: 48%;
}

.team-panel {
  position: absolute;
  right: clamp(28px, 6vw, 92px);
  bottom: 34px;
  z-index: 4;
  width: min(360px, calc(100vw - 56px));
  padding: 18px 20px;
  border: 1px solid rgba(125, 216, 255, 0.35);
  border-radius: 8px;
  background: rgba(4, 11, 18, 0.68);
  backdrop-filter: blur(14px);
  box-shadow: 0 0 26px rgba(62, 142, 210, 0.16);
}

.panel-label {
  color: #80d9ff;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.22em;
}

.team-panel h2 {
  margin: 6px 0 14px;
  font-size: 19px;
}

.member-list {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.member-list span {
  padding: 7px 12px;
  border-radius: 999px;
  color: #f2fbff;
  background: rgba(125, 216, 255, 0.12);
  border: 1px solid rgba(125, 216, 255, 0.32);
  font-weight: 700;
}

@media (max-width: 980px) {
  .home-nav {
    height: auto;
    min-height: 72px;
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
    padding: 18px 22px;
  }

  .brand-main {
    font-size: 22px;
  }

  .brand-sub {
    font-size: 16px;
  }

  .nav-links {
    width: 100%;
    justify-content: flex-start;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .account {
    display: none;
  }

  .hero {
    min-height: auto;
    grid-template-columns: 1fr;
    padding: 34px 22px 170px;
  }

  .theme-visual {
    min-height: 380px;
    margin-top: 22px;
  }

  .city-board {
    width: min(76vw, 430px);
  }
}

@media (max-width: 620px) {
  .brand {
    gap: 10px;
  }

  .brand-globe {
    width: 32px;
    height: 32px;
  }

  .brand-main {
    font-size: 19px;
  }

  .brand-sub {
    padding-left: 10px;
    font-size: 14px;
  }

  h1 {
    font-size: 38px;
  }

  .tagline {
    border-radius: 8px;
    font-size: 18px;
  }

  .hero-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .team-panel {
    left: 22px;
    right: 22px;
    bottom: 24px;
    width: auto;
  }
}
</style>
