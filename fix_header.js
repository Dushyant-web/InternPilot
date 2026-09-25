const fs = require('fs');
let c = fs.readFileSync('views/partials/header.ejs', 'utf8');

// Replace company links with dropdown
const companyLinksTarget = `<% } else if (['company', 'recruiter'].includes(currentUser.role)) { %>
                            <a href="/company/dashboard" data-nav-link data-nav-variant="desktop" data-nav-prefixes="<%= navPrefixAttribute('companyDashboard') %>" class="<%= desktopLinkClass(isActive('companyDashboard')) %>" <%- ariaCurrent(isActive('companyDashboard')) %>>Company Dashboard</a>
                            <a href="/company/profile" data-nav-link data-nav-variant="desktop" data-nav-prefixes="<%= navPrefixAttribute('companyProfile') %>" class="<%= desktopLinkClass(isActive('companyProfile')) %>" <%- ariaCurrent(isActive('companyProfile')) %>>Company Profile</a>
                            <% if (currentUser.role === 'company') { %>
                                <a href="/company/team" data-nav-link data-nav-variant="desktop" data-nav-prefixes="<%= navPrefixAttribute('manageTeam') %>" class="<%= desktopLinkClass(isActive('manageTeam')) %>" <%- ariaCurrent(isActive('manageTeam')) %>>Manage Team</a>
                                <a href="/company/activity" data-nav-link data-nav-variant="desktop" data-nav-prefixes="<%= navPrefixAttribute('activityHistory') %>" class="<%= desktopLinkClass(isActive('activityHistory')) %>" <%- ariaCurrent(isActive('activityHistory')) %>>Activity History</a>
                            <% } %>`;

const companyLinksReplacement = `<% } else if (['company', 'recruiter'].includes(currentUser.role)) { %>
                            <a href="/company/dashboard" data-nav-link data-nav-variant="desktop" data-nav-prefixes="<%= navPrefixAttribute('companyDashboard') %>" class="<%= desktopLinkClass(isActive('companyDashboard')) %>" <%- ariaCurrent(isActive('companyDashboard')) %>>Company Dashboard</a>
                            <div class="group relative inline-block">
                                <button class="flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-indigo-600 px-3 py-2 transition-colors">
                                    Manage <i class="ph-bold ph-caret-down text-xs transition-transform group-hover:rotate-180"></i>
                                </button>
                                <div class="absolute left-0 top-full mt-1 hidden w-48 rounded-xl border border-slate-200 bg-white shadow-lg group-hover:block z-50 overflow-hidden">
                                    <a href="/company/profile" data-nav-link data-nav-variant="desktop" data-nav-prefixes="<%= navPrefixAttribute('companyProfile') %>" class="block px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors">Company Profile</a>
                                    <% if (currentUser.role === 'company') { %>
                                        <a href="/company/team" data-nav-link data-nav-variant="desktop" data-nav-prefixes="<%= navPrefixAttribute('manageTeam') %>" class="block px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 border-t border-slate-100 transition-colors">Manage Team</a>
                                        <a href="/company/activity" data-nav-link data-nav-variant="desktop" data-nav-prefixes="<%= navPrefixAttribute('activityHistory') %>" class="block px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 border-t border-slate-100 transition-colors">Activity History</a>
                                    <% } %>
                                </div>
                            </div>`;

c = c.replace(companyLinksTarget, companyLinksReplacement);


// Replace avatar with dropdown
const avatarTarget = `<div class="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 sm:flex">
                            <% if (currentUser.avatar) { %>
                                <img src="<%= currentUser.avatar %>" alt="User Avatar" class="h-6 w-6 rounded-full border border-slate-300 object-cover">
                            <% } else { %>
                                <div class="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white"><%= currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U' %></div>
                            <% } %>
                            <span class="max-w-[100px] truncate text-xs font-semibold text-slate-700"><%= currentUser.name %></span>
                        </div>
                        <a href="/auth/logout" class="rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 sm:px-3">Log Out</a>`;

const avatarReplacement = `<div class="group relative hidden sm:block">
                            <button class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 transition-colors hover:bg-slate-200 cursor-pointer">
                                <% if (currentUser.avatar) { %>
                                    <img src="<%= currentUser.avatar %>" alt="User Avatar" class="h-6 w-6 rounded-full border border-slate-300 object-cover">
                                <% } else { %>
                                    <div class="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white"><%= currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U' %></div>
                                <% } %>
                                <span class="max-w-[100px] truncate text-xs font-semibold text-slate-700"><%= currentUser.name %></span>
                                <i class="ph-bold ph-caret-down text-[10px] text-slate-500 transition-transform group-hover:rotate-180"></i>
                            </button>
                            <div class="absolute right-0 top-full mt-2 hidden w-40 rounded-xl border border-slate-200 bg-white shadow-lg group-hover:block z-50 p-1">
                                <a href="/auth/logout" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50">
                                    <i class="ph-bold ph-sign-out"></i> Log Out
                                </a>
                            </div>
                        </div>`;
                        
c = c.replace(avatarTarget, avatarReplacement);
fs.writeFileSync('views/partials/header.ejs', c);
