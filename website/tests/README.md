# Prop update regression checks

Build the component (`npm run build --prefix gensplore-component` from the repo
root), start the website dev server, and open `/tests/prop-updates.html`.
The fixture keeps the same viewer mounted and uses only artificial DNA.

1. Wait for **Prop update comparison** to appear as the heading. Click **Remove
   prop**: the heading and browser title must return to **REFERENCE_A**, and the
   Compare drawer must contain no results. Reload with **Load comparison prop**,
   then repeat with **Empty prop**.
2. Remove the comparison, open the viewer search with Ctrl/Cmd+F, and enter `AAA`.
   Reference A must show **Hit 1 of 8**. Advance to a later hit, then click
   **Reference B**: it must show **No hits found**, with no highlighted old hits.
   Click **Reference A**: it must return to **Hit 1 of 8**.
3. With a comparison load pending, removing the prop must clear its loading state
   and prevent a late fetch/worker result from bringing the comparison back.

The regression page is outside `public/` and is not shipped by the website build.
