# Issue #36: Internship Comparison - Implementation Plan

## 1. Problem Statement & Expected Outcome
- **Problem**: Students evaluating multiple internship options have no direct way to compare stipends, durations, locations, and requirements side-by-side.
- **Outcome**: A feature allowing students to select 2–3 internships from the Opportunities page and view a side-by-side comparison table.
- **Constraints**: 
  - Compare at least: requirements, stipend, duration, location, and company.
  - Checkboxes on listing cards.

## 2. Approach & Architecture
We will build a simple, stateless UI layer for the comparison selection and a dedicated route/view for the side-by-side comparison table.

**Components needed:**
1. **Selection UI (`views/extras/internships.ejs`)**: Add a "Compare" checkbox to every internship card.
2. **Floating Action Bar**: A sticky bar at the bottom of the screen that becomes visible when >= 1 checkbox is selected, showing the count (e.g., "2 selected (Max 3)") and a "Compare" submit button.
3. **Comparison Route (`routes/internships.js`)**: A new `GET /internships/compare` route that takes query parameters (e.g., `?ids=id1,id2,id3`).
4. **Comparison View (`views/extras/internship-compare.ejs`)**: A dedicated page displaying the selected internships in a responsive CSS Grid or HTML Table.

## 3. Implementation Details

### A. Route Handler (`routes/internships.js`)
*Must be placed BEFORE `router.get('/:id', ...)` to avoid route masking conflicts.*
```javascript
router.get('/compare', async (req, res) => {
    try {
        const ids = req.query.ids ? req.query.ids.split(',') : [];
        if (ids.length < 2 || ids.length > 3) {
            req.flash('error_msg', 'Please select 2 to 3 internships to compare.');
            return res.redirect('/internships');
        }
        const internships = await Internship.find({ _id: { $in: ids } }).lean();
        res.render('extras/internship-compare', { internships, currentUser: req.user });
    } catch (error) { ... }
});
```

### B. View: Checkboxes & Floating Bar (`views/extras/internships.ejs`)
- Add a checkbox to each internship card header (visible to candidates and unauthenticated users).
- Inject a hidden `div#compareBar` fixed to the bottom.
- Inject a tiny `<script>` at the bottom of the page to handle the checkbox array, max limits, and form submission.

### C. View: Comparison Table (`views/extras/internship-compare.ejs`)
- A clean page with a "Back to Opportunities" button.
- A horizontal scrolling container (for mobile) containing a side-by-side table.
- **Rows to compare:**
  1. Company Name
  2. Role Title
  3. Location (District, State)
  4. Stipend & Perks
  5. Duration
  6. Minimum Qualifications
  7. Required Skills (rendered as pill tags)
  8. Application Deadline
  9. Action Row (Apply Button)

## 4. UI/UX Considerations
- If a user tries to select a 4th internship, we will uncheck it and show a browser `alert()` or toast message explaining the max limit.
- The floating action bar will elegantly slide up using Tailwind translation classes (`translate-y-full` to `translate-y-0`).
- The comparison table will handle empty fields gracefully (e.g., "Not specified" in light gray text).

## 5. Security & Error Handling
- Invalid `ids` or non-existent IDs in the query string will simply not be rendered.
- If fewer than 2 valid internships are found by the query, the user is redirected back with an error flash message.

## 6. Execution Sequence
1. Create `views/extras/internship-compare.ejs` with the table layout.
2. Update `routes/internships.js` to serve the new `/compare` endpoint.
3. Modify `views/extras/internships.ejs` to include the checkbox inputs.
4. Add the frontend JavaScript to manage the Floating Action Bar and trigger the redirection to `/internships/compare?ids=...`.
