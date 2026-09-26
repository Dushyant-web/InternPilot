# Issue #117: Streamline Header Navigation - Implementation Plan

## 1. Problem Statement & Expected Outcomes
The desktop header layout currently has poor visual hierarchy and spatial balance due to overcrowding. There are up to 7 navigation links, logos, and action buttons.

**Goals:**
1. **Improved Spatial Balance**: Ensure clean whitespace and prevent wrapping of navigation items.
2. **Streamlined Navigation (Company)**: Consolidate `Company Profile`, `Manage Team`, and `Activity History` under a single `Manage` dropdown menu.
3. **Encapsulated User Actions**: Move the standalone "Log Out" button into a user profile avatar dropdown menu.

## 2. Implementation Steps

### Step 1: Fix Avatar & Encapsulate Log Out
Currently (lines 122-132 in `views/partials/header.ejs`), the user avatar and the Log Out button are side by side:
```html
<div class="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 sm:flex">
    <!-- Avatar & Name -->
</div>
<a href="/auth/logout" class="rounded-lg border border-red-200 ...">Log Out</a>
```
We will convert the Avatar container into a Tailwind `group relative` dropdown menu:
- The avatar block becomes a clickable/hoverable button.
- A dropdown menu (`absolute right-0 top-full mt-2 hidden group-hover:block`) will contain the "Log Out" action.

### Step 2: Consolidate Company Navigation Links
Currently (lines 87-93), company roles see:
```html
<a href="/company/dashboard">Company Dashboard</a>
<a href="/company/profile">Company Profile</a>
<a href="/company/team">Manage Team</a>
<a href="/company/activity">Activity History</a>
```
We will convert this into:
```html
<a href="/company/dashboard" ...>Company Dashboard</a>
<!-- Dropdown for Manage -->
<div class="group relative inline-block">
    <button class="flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-indigo-600 px-3 py-2">
        Manage <i class="ph-bold ph-caret-down text-xs"></i>
    </button>
    <div class="absolute left-0 top-full mt-1 hidden w-48 rounded-xl border border-slate-200 bg-white shadow-lg group-hover:block z-50">
        <a href="/company/profile" class="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-t-xl">Company Profile</a>
        <a href="/company/team" class="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600">Manage Team</a>
        <a href="/company/activity" class="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-b-xl">Activity History</a>
    </div>
</div>
```

### Step 3: Enhance Spatial Balance
- Verify the main navigation container has `flex gap-2` or `gap-4` to prevent crowding.
- Update the layout structure for the right-hand utility section to gracefully incorporate the new avatar menu.

## 3. Verification
- Verify Company User sees "Company Dashboard" and "Manage" dropdown.
- Verify hovering "Manage" reveals the 3 sub-links.
- Verify hovering User Avatar reveals the "Log Out" button.
- Check responsive behavior on mobile (mobile nav might just list them all out, as dropdowns on mobile nav usually just stack vertically).
