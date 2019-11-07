# Web Performance Exploration

Implementation on the measurement of several metrics (including potentially new ones) for web pages, with other findings and analysis.

### Definition

Web performance of a certain page is the performance of **how the browser exhibits certain page**. The factors that mainly influence such process are *browser's mechanism* and *page's architecture*, and underlying factors include machine configuration, network status and others. 

### Paint Events of Interest

1. drawRect
2. drawImageRect
3. drawTextBlob

### Computing Visibility Changes

With each **LayerTree.layerPainted** event, a sequence of command logs is recorded. Each command that is a paint event of interest will be counted as a *Regional Update*. 

**Q**: How to calculate regions and divide them?

**TODO**: Understanding paint events of interest.