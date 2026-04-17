# Stage1 Final Cross-Model Analysis

Generated: 2026-04-17T00:23:23.882Z

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

- linear: 9 models, avg pattern families 40, unclassified on 0/9
  - models: arch_multi_layer, arch_single, cane_grouped, cane_single, cane_stick_grouped, icicles_drop_pattern, single_line_horizontal, single_line_single_node, single_line_vertical
- matrix: 3 models, avg pattern families 47, unclassified on 0/3
  - models: matrix_high_density, matrix_low_density, matrix_medium_density
- radial: 1 models, avg pattern families 19, unclassified on 0/1
  - models: spinner_standard
- star: 2 models, avg pattern families 19, unclassified on 0/2
  - models: star_multi_layer, star_single_layer
- tree: 3 models, avg pattern families 28.67, unclassified on 0/3
  - models: tree_360_round, tree_360_spiral, tree_flat_single_layer

## Strongest Effects

- Twinkle: avg 8 families/model, collapsed on 0/18
- Shockwave: avg 6.06 families/model, collapsed on 0/18
- Bars: avg 4.17 families/model, collapsed on 3/18
- Color Wash: avg 3.67 families/model, collapsed on 6/18
- SingleStrand: avg 3.33 families/model, collapsed on 3/18

## Most Collapsed Effects

- On: collapsed on 15/18, avg 1.33 families/model
- Shimmer: collapsed on 15/18, avg 1.5 families/model
- Marquee: collapsed on 6/18, avg 2.5 families/model
- Color Wash: collapsed on 6/18, avg 3.67 families/model
- Pinwheel: collapsed on 4/18, avg 3.22 families/model
- Spirals: collapsed on 3/18, avg 2.67 families/model
- SingleStrand: collapsed on 3/18, avg 3.33 families/model
- Bars: collapsed on 3/18, avg 4.17 families/model

## Unclassified Pattern Family Presence

- none

## Model Pattern Family Counts

- arch_multi_layer: 40 families, analyzer linear, records 2608
- arch_single: 40 families, analyzer linear, records 2608
- cane_grouped: 40 families, analyzer linear, records 2608
- cane_single: 40 families, analyzer linear, records 2608
- cane_stick_grouped: 40 families, analyzer linear, records 2608
- icicles_drop_pattern: 40 families, analyzer linear, records 2608
- matrix_high_density: 47 families, analyzer matrix, records 2608
- matrix_low_density: 47 families, analyzer matrix, records 2608
- matrix_medium_density: 47 families, analyzer matrix, records 2608
- single_line_horizontal: 40 families, analyzer linear, records 2608
- single_line_single_node: 40 families, analyzer linear, records 2468
- single_line_vertical: 40 families, analyzer linear, records 2608
- spinner_standard: 19 families, analyzer radial, records 2608
- star_multi_layer: 19 families, analyzer star, records 2608
- star_single_layer: 19 families, analyzer star, records 2608
- tree_360_round: 30 families, analyzer tree, records 2608
- tree_360_spiral: 26 families, analyzer tree, records 2608
- tree_flat_single_layer: 30 families, analyzer tree, records 2608

## Conclusion

- First-pass coverage is complete and valid across the full 2026.06 model set.
- The remaining quality issues are analyzer granularity in collapsed effects, not missing evidence.
- Second-pass work should focus on collapsed effects first, especially Color Wash, On, Shimmer, and geometry-specific underfit in non-matrix analyzers.
