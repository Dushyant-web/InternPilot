const fs = require('fs');
let c = fs.readFileSync('views/extras/internship-detail.ejs', 'utf8');

const target = `            <div class="sm:text-right shrink-0 flex flex-col items-end">
                <div class="flex items-center gap-3 mb-1">
                    <div class="text-xs text-slate-400 font-medium">Monthly Stipend</div>
                    <% if (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'candidate') { %>
                        <% const isSaved = currentUser.savedInternships && currentUser.savedInternships.includes(internship._id.toString()); %>
                        <button class="bookmark-btn text-slate-400 hover:text-indigo-600 transition-all active:scale-90" data-id="<%= internship._id %>" title="Save Internship">
                            <i class="<%= isSaved ? 'ph-fill text-indigo-600' : 'ph-bold' %> ph-heart text-xl"></i>
                        </button>
                    <% } %>
                </div>`;
const replacement = `            <div class="sm:text-right shrink-0">
                <div class="text-xs text-slate-400 font-medium">Monthly Stipend</div>`;
c = c.replace(target, replacement);

const target2 = `                            <!-- 5. LOGGED IN CANDIDATE & HAS NOT APPLIED & OPEN -->
                            <form action="/internships/<%= internship._id %>/apply" method="POST">
                                <button type="submit"
                                    class="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer">
                                    <i class="ph-bold ph-paper-plane-tilt text-lg"></i>
                                    Apply Now
                                </button>
                            </form>`;
const replacement2 = `                            <!-- 5. LOGGED IN CANDIDATE & HAS NOT APPLIED & OPEN -->
                            <div class="flex items-center gap-3 w-full">
                                <form action="/internships/<%= internship._id %>/apply" method="POST" class="flex-1">
                                    <button type="submit"
                                        class="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer">
                                        <i class="ph-bold ph-paper-plane-tilt text-lg"></i>
                                        Apply Now
                                    </button>
                                </form>
                                <% if (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'candidate') { %>
                                    <% const isSaved = currentUser.savedInternships && currentUser.savedInternships.includes(internship._id.toString()); %>
                                    <button class="bookmark-btn flex-shrink-0 w-11 h-11 flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 transition-all active:scale-95 shadow-sm" data-id="<%= internship._id %>" title="Save Internship">
                                        <i class="<%= isSaved ? 'ph-fill text-indigo-600' : 'ph-bold' %> ph-bookmark-simple text-xl"></i>
                                    </button>
                                <% } %>
                            </div>`;

c = c.replace(target2, replacement2);
fs.writeFileSync('views/extras/internship-detail.ejs', c);
