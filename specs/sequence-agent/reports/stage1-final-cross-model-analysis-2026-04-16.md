# Stage1 Final Cross-Model Analysis

Generated: 2026-04-17T00:12:09.778Z

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

- linear: 9 models, avg pattern families 23, unclassified on 9/9
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
- Bars: avg 4.17 families/model, collapsed on 3/18
- Shockwave: avg 3.56 families/model, collapsed on 9/18
- SingleStrand: avg 3.33 families/model, collapsed on 3/18
- Marquee: avg 2.5 families/model, collapsed on 6/18

## Most Collapsed Effects

- On: collapsed on 15/18, avg 1.33 families/model
- Shimmer: collapsed on 15/18, avg 1.5 families/model
- Color Wash: collapsed on 15/18, avg 1.67 families/model, unclassified on 9/18
- Pinwheel: collapsed on 13/18, avg 1.72 families/model, unclassified on 9/18
- Spirals: collapsed on 12/18, avg 1.67 families/model, unclassified on 9/18
- Shockwave: collapsed on 9/18, avg 3.56 families/model, unclassified on 9/18
- Marquee: collapsed on 6/18, avg 2.5 families/model
- SingleStrand: collapsed on 3/18, avg 3.33 families/model

## Unclassified Pattern Family Presence

- single_line_horizontal (SingleLineHorizontal, linear)
- arch_multi_layer (ArchTripleLayer, linear)
- arch_single (ArchSingle, linear)
- single_line_vertical (SingleLineVertical, linear)
- icicles_drop_pattern (Icicles, linear)
- cane_grouped (CaneGroup, linear)
- cane_single (CaneSingle, linear)
- cane_stick_grouped (CaneStickGroup, linear)
- single_line_single_node (SingleLineSingleNode, linear)

## Model Pattern Family Counts

- arch_multi_layer: 23 families, analyzer linear, records 2608
- arch_single: 23 families, analyzer linear, records 2608
- cane_grouped: 23 families, analyzer linear, records 2608
- cane_single: 23 families, analyzer linear, records 2608
- cane_stick_grouped: 23 families, analyzer linear, records 2608
- icicles_drop_pattern: 23 families, analyzer linear, records 2608
- matrix_high_density: 47 families, analyzer matrix, records 2608
- matrix_low_density: 47 families, analyzer matrix, records 2608
- matrix_medium_density: 47 families, analyzer matrix, records 2608
- single_line_horizontal: 23 families, analyzer linear, records 2608
- single_line_single_node: 23 families, analyzer linear, records 2468
- single_line_vertical: 23 families, analyzer linear, records 2608
- spinner_standard: 19 families, analyzer radial, records 2608
- star_multi_layer: 19 families, analyzer star, records 2608
- star_single_layer: 19 families, analyzer star, records 2608
- tree_360_round: 30 families, analyzer tree, records 2608
- tree_360_spiral: 26 families, analyzer tree, records 2608
- tree_flat_single_layer: 30 families, analyzer tree, records 2608

## Conclusion

- First-pass coverage is complete and valid across the full 2026.06 model set.
- The remaining quality issues are analyzer granularity and unclassified linear-family behavior, not missing evidence.
- Second-pass work should focus on collapsed effects first, especially Color Wash, On, Shimmer, and geometry-specific underfit in non-matrix analyzers.
