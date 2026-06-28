## 2024-06-28 - Optimize Array Iterations in Physics Engine
**Learning:** In a highly iterated loop like a physics simulation running hundreds of times per generation for a GA swarm, using classic `for (let i=0; i<len; i++)` instead of `for...of` or `.forEach` can drastically decrease execution time. By applying this to `activePlatforms` iteration in `physicsStep` and avoiding redundant closures, execution time decreased measurably.
**Action:** Always prefer classic `for` loops in hot paths over `for...of` or array methods (forEach, map) if micro-performance matters.
