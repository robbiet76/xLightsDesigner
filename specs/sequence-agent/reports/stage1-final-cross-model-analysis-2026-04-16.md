# Stage1 Final Cross-Model Analysis

Generated: 2026-04-17T00:44:01.934Z

## Overall

- models: 18
- records: 46804
- effects: 10
- analyzer families: linear, matrix, radial, star, tree
- model types: arch, cane, icicles, matrix, single_line, spinner, star, tree_360, tree_flat
- all validation reports clean: yes

## Validation

- coverage gaps: 0
- palette gaps: 0
- parameter gaps: 0
- pattern-family gaps: 0

## Analyzer Families

- linear: 9 models, avg pattern families 45, unclassified on 0/9
  - models: arch_multi_layer, arch_single, cane_grouped, cane_single, cane_stick_grouped, icicles_drop_pattern, single_line_horizontal, single_line_single_node, single_line_vertical
- matrix: 3 models, avg pattern families 47, unclassified on 0/3
  - models: matrix_high_density, matrix_low_density, matrix_medium_density
- radial: 1 models, avg pattern families 36, unclassified on 0/1
  - models: spinner_standard
- star: 2 models, avg pattern families 36, unclassified on 0/2
  - models: star_multi_layer, star_single_layer
- tree: 3 models, avg pattern families 43.33, unclassified on 0/3
  - models: tree_360_round, tree_360_spiral, tree_flat_single_layer

## Strongest Effects

- Twinkle: avg 8 families/model, collapsed on 0/18
- Shockwave: avg 6.06 families/model, collapsed on 0/18
- Color Wash: avg 5 families/model, collapsed on 0/18
- Bars: avg 4.17 families/model, collapsed on 3/18
- Pinwheel: avg 4 families/model, collapsed on 0/18

## Most Collapsed Effects

- Spirals: collapsed on 3/18, avg 2.67 families/model
- SingleStrand: collapsed on 3/18, avg 3.33 families/model
- Bars: collapsed on 3/18, avg 4.17 families/model
- On: collapsed on 0/18, avg 3 families/model
- Marquee: collapsed on 0/18, avg 3.5 families/model
- Pinwheel: collapsed on 0/18, avg 4 families/model
- Shimmer: collapsed on 0/18, avg 4 families/model
- Color Wash: collapsed on 0/18, avg 5 families/model

## Unclassified Pattern Family Presence

- none

## Model Pattern Family Counts

- arch_multi_layer: 45 families, analyzer linear, records 2608
- arch_single: 45 families, analyzer linear, records 2608
- cane_grouped: 45 families, analyzer linear, records 2608
- cane_single: 45 families, analyzer linear, records 2608
- cane_stick_grouped: 45 families, analyzer linear, records 2608
- icicles_drop_pattern: 45 families, analyzer linear, records 2608
- matrix_high_density: 47 families, analyzer matrix, records 2608
- matrix_low_density: 47 families, analyzer matrix, records 2608
- matrix_medium_density: 47 families, analyzer matrix, records 2608
- single_line_horizontal: 45 families, analyzer linear, records 2608
- single_line_single_node: 45 families, analyzer linear, records 2468
- single_line_vertical: 45 families, analyzer linear, records 2608
- spinner_standard: 36 families, analyzer radial, records 2608
- star_multi_layer: 36 families, analyzer star, records 2608
- star_single_layer: 36 families, analyzer star, records 2608
- tree_360_round: 44 families, analyzer tree, records 2608
- tree_360_spiral: 42 families, analyzer tree, records 2608
- tree_flat_single_layer: 44 families, analyzer tree, records 2608

## Conclusion

- First-pass coverage is complete and valid across the full 2026.06 model set.
- The remaining quality issues are analyzer granularity in the still-collapsed effects, not missing evidence.
- Second-pass work should now focus on the remaining collapsed effects first, especially Spirals, SingleStrand, Bars, and geometry-specific underfit outside matrix.
