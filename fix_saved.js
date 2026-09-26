const fs = require('fs');
let c = fs.readFileSync('views/candidate/saved-internships.ejs', 'utf8');

c = c.replace(/<button class="bookmark-btn absolute top-5 right-5[\s\S]*?<\/button>/, '');

const target = `                        <a href="/internships/<%= item._id %>" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group/btn transition-colors">
                            View Details
                            <i class="ph-bold ph-arrow-right group-hover/btn:translate-x-0.5 transition-transform"></i>
                        </a>
                    </div>`;

const replacement = `                        <div class="flex items-center gap-3">
                            <a href="/internships/<%= item._id %>" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group/btn transition-colors">
                                View Details
                                <i class="ph-bold ph-arrow-right group-hover/btn:translate-x-0.5 transition-transform"></i>
                            </a>
                            <button class="bookmark-btn flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-indigo-600 transition-all active:scale-95 shadow-sm" data-id="<%= item._id %>" title="Remove Bookmark">
                                <i class="ph-fill ph-bookmark-simple text-base"></i>
                            </button>
                        </div>
                    </div>`;
                    
c = c.replace(target, replacement);
fs.writeFileSync('views/candidate/saved-internships.ejs', c);
