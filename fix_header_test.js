const fs = require('fs');
let c = fs.readFileSync('views/partials/header.ejs', 'utf8');

c = c.replace(
    `<a href="/company/profile" data-nav-link data-nav-variant="desktop" data-nav-prefixes="<%= navPrefixAttribute('companyProfile') %>" class="block px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors">Company Profile</a>`,
    `<a href="/company/profile" data-nav-link data-nav-variant="desktop" data-nav-prefixes="<%= navPrefixAttribute('companyProfile') %>" class="block px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors <%= isActive('companyProfile') ? 'bg-indigo-50 font-bold text-indigo-700' : '' %>" <%- ariaCurrent(isActive('companyProfile')) %>>Company Profile</a>`
);

c = c.replace(
    `<a href="/company/team" data-nav-link data-nav-variant="desktop" data-nav-prefixes="<%= navPrefixAttribute('manageTeam') %>" class="block px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 border-t border-slate-100 transition-colors">Manage Team</a>`,
    `<a href="/company/team" data-nav-link data-nav-variant="desktop" data-nav-prefixes="<%= navPrefixAttribute('manageTeam') %>" class="block px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 border-t border-slate-100 transition-colors <%= isActive('manageTeam') ? 'bg-indigo-50 font-bold text-indigo-700' : '' %>" <%- ariaCurrent(isActive('manageTeam')) %>>Manage Team</a>`
);

c = c.replace(
    `<a href="/company/activity" data-nav-link data-nav-variant="desktop" data-nav-prefixes="<%= navPrefixAttribute('activityHistory') %>" class="block px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 border-t border-slate-100 transition-colors">Activity History</a>`,
    `<a href="/company/activity" data-nav-link data-nav-variant="desktop" data-nav-prefixes="<%= navPrefixAttribute('activityHistory') %>" class="block px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 border-t border-slate-100 transition-colors <%= isActive('activityHistory') ? 'bg-indigo-50 font-bold text-indigo-700' : '' %>" <%- ariaCurrent(isActive('activityHistory')) %>>Activity History</a>`
);

// We should also highlight the "Manage" dropdown button itself if any of its children are active
c = c.replace(
    `<button class="flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-indigo-600 px-3 py-2 transition-colors">`,
    `<button class="flex items-center gap-1 text-sm font-semibold transition-colors px-3 py-2 rounded-lg <%= isActive('companyProfile') || isActive('manageTeam') || isActive('activityHistory') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50' %>">`
);

fs.writeFileSync('views/partials/header.ejs', c);
