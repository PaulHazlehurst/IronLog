/* ============================================================
   BODY MAP — simple geometric front/back silhouettes, muscles
   colored by recovery %. Intentionally blocky/schematic (paper-
   doll style), not an anatomical illustration.
   ============================================================ */

const BodyMap = {
  render(percents) {
    const c = (m) => Recovery.colorFor(percents[m] ?? 100);
    const grey = 'var(--surface-2)';
    const stroke = 'var(--border)';

    // Front figure (x offset 0), Back figure (x offset 150)
    return `
    <svg viewBox="0 0 300 320" style="width:100%;max-width:420px;height:auto;" role="img" aria-label="Front and back muscle recovery map">
      <!-- FRONT -->
      <g>
        <circle cx="60" cy="24" r="16" fill="${grey}" stroke="${stroke}"/>
        <rect x="52" y="38" width="16" height="12" fill="${grey}"/>
        <!-- shoulders -->
        <ellipse cx="34" cy="58" rx="13" ry="10" fill="${c('Shoulders')}" stroke="${stroke}"/>
        <ellipse cx="86" cy="58" rx="13" ry="10" fill="${c('Shoulders')}" stroke="${stroke}"/>
        <!-- chest -->
        <rect x="38" y="52" width="44" height="34" rx="8" fill="${c('Chest')}" stroke="${stroke}"/>
        <!-- torso base -->
        <rect x="40" y="84" width="40" height="26" fill="${grey}" stroke="${stroke}"/>
        <!-- abs -->
        <rect x="45" y="86" width="30" height="34" rx="4" fill="${c('Abs')}" stroke="${stroke}"/>
        <!-- biceps -->
        <rect x="18" y="64" width="13" height="38" rx="6" fill="${c('Biceps')}" stroke="${stroke}"/>
        <rect x="89" y="64" width="13" height="38" rx="6" fill="${c('Biceps')}" stroke="${stroke}"/>
        <!-- forearms (untracked) -->
        <rect x="16" y="102" width="11" height="34" rx="5" fill="${grey}" stroke="${stroke}"/>
        <rect x="93" y="102" width="11" height="34" rx="5" fill="${grey}" stroke="${stroke}"/>
        <!-- hips -->
        <rect x="42" y="120" width="36" height="14" fill="${grey}" stroke="${stroke}"/>
        <!-- quads -->
        <rect x="42" y="134" width="16" height="46" rx="6" fill="${c('Quads')}" stroke="${stroke}"/>
        <rect x="62" y="134" width="16" height="46" rx="6" fill="${c('Quads')}" stroke="${stroke}"/>
        <!-- calves (front) -->
        <rect x="43" y="182" width="14" height="34" rx="5" fill="${c('Calves')}" stroke="${stroke}"/>
        <rect x="63" y="182" width="14" height="34" rx="5" fill="${c('Calves')}" stroke="${stroke}"/>
        <text x="60" y="232" font-size="11" fill="var(--text-dim)" text-anchor="middle">FRONT</text>
      </g>

      <!-- BACK -->
      <g transform="translate(150,0)">
        <circle cx="60" cy="24" r="16" fill="${grey}" stroke="${stroke}"/>
        <rect x="52" y="38" width="16" height="12" fill="${grey}"/>
        <!-- traps/shoulders -->
        <ellipse cx="34" cy="58" rx="13" ry="10" fill="${c('Shoulders')}" stroke="${stroke}"/>
        <ellipse cx="86" cy="58" rx="13" ry="10" fill="${c('Shoulders')}" stroke="${stroke}"/>
        <!-- back -->
        <rect x="38" y="52" width="44" height="52" rx="8" fill="${c('Back')}" stroke="${stroke}"/>
        <!-- triceps -->
        <rect x="18" y="64" width="13" height="38" rx="6" fill="${c('Triceps')}" stroke="${stroke}"/>
        <rect x="89" y="64" width="13" height="38" rx="6" fill="${c('Triceps')}" stroke="${stroke}"/>
        <rect x="16" y="102" width="11" height="34" rx="5" fill="${grey}" stroke="${stroke}"/>
        <rect x="93" y="102" width="11" height="34" rx="5" fill="${grey}" stroke="${stroke}"/>
        <!-- glutes -->
        <rect x="40" y="104" width="40" height="22" rx="8" fill="${c('Glutes')}" stroke="${stroke}"/>
        <!-- hamstrings -->
        <rect x="42" y="134" width="16" height="46" rx="6" fill="${c('Hamstrings')}" stroke="${stroke}"/>
        <rect x="62" y="134" width="16" height="46" rx="6" fill="${c('Hamstrings')}" stroke="${stroke}"/>
        <!-- calves (back) -->
        <rect x="43" y="182" width="14" height="34" rx="5" fill="${c('Calves')}" stroke="${stroke}"/>
        <rect x="63" y="182" width="14" height="34" rx="5" fill="${c('Calves')}" stroke="${stroke}"/>
        <text x="60" y="232" font-size="11" fill="var(--text-dim)" text-anchor="middle">BACK</text>
      </g>
    </svg>`;
  }
};
