let filtered = false,
    reports = [],
    filteredReports = [], 
    tags = [];
    selectedIndex = 0,
    viewMode = false, // false : report list, 1=true : report viewer
    rpViewer = document.getElementById("rp-viewer"), // report viewer DOM
    main = document.getElementById("main"), // main DOM 
    suggestionListDom = null;
    elasticlunr.clearStopWords();
    // search engine to search report
    let searchEngine = elasticlunr(function () {   
                                        this.addField('content');
                                        this.setRef('id');
                                    }),
    // suggest word search engine to search for suggested words
        suggestWordSE = elasticlunr(function () {
                                        this.addField('word');
                                        this.setRef('id');
                                    });
        
    badgesType = new Map();
    badgesType.set("tag-1", "bg-success");
    badgesType.set("tag-2", "bg-danger");

loadData()
    .then((rp) => buildUI(rp))
    .catch(e => buildErrUI(e));

function buildErrUI(e) {
    main = document.getElementById("main");
    let d = document.createElement("div");
    d.className = "m-5";
    d.innerHTML = "Error getting data ! <br> Have you started docker yet ? <br> Guide can be found in README.md file";

    main.appendChild(d);
}

async function loadData() {
    // load data from localStorage if already had
    // otherwise, get from text file;
    tags = JSON.parse(localStorage.getItem("segmed-tags"));

    const rp = localStorage.getItem("segmed-rp");
    if (rp) {
        reports = JSON.parse(rp);
        filteredReports = [...reports];
        return filteredReports;
    }

    console.log('Getting sample data');
    const response = await fetch("http://localhost:8080/reports.txt");
    if (!response.ok) {
        throw new Error(`Error getting data! status: ${response.status}. <br> Have you started docker yet ? <br> Guide can be found in README.md file`);
    }
    
    const content = await response.text();
    let first = second = 0;
    for(let i=1;i<=50;i++) {
        const title = `Chapter ${i}`;
        first = content.indexOf(title);    
        second = content.indexOf(`Chapter ${i + 1}`);
        let rp = "";
        if (i < 50) {
            rp = content.substring(first, second);
        } else {
            rp = content.substring(first);
        }
        reports.push({
            id: i,
            title: title,
            content : rp,
            tags : []
        });
    }
    filteredReports = [...reports];
    tags = [
        {
            id: "tag-1",
            name : "#goodreport (1)"
        },
        {
            id: "tag-2",
            name : "#conditionpresent (2)"
        },
    ]
    syncDataToLocalStorage(reports, tags);
    return reports;
}

// everytime data is updated, sync to localStorage also to keep localStorage data always up to date
function updateData(rp) {
    const index = reports.findIndex((r) => r.id === rp.id);
    reports[index] = {...rp};
    syncDataToLocalStorage(reports, tags);
}

// Sync Data to Local storage for use later
function syncDataToLocalStorage(data, tags) {
    localStorage.setItem("segmed-rp", JSON.stringify(data));
    localStorage.setItem("segmed-tags", JSON.stringify(tags));
}

// Build all the UI 
function buildUI(reports) {
    
    let divS = document.createElement("div");
    divS.className = "row m-5";

    let d = document.createElement("div");
    d.className = "col-6 autocomplete";

    suggestionListDom = document.createElement("div");
    suggestionListDom.setAttribute("id", "search-autocomplete-list");
    suggestionListDom.setAttribute("class", "autocomplete-items");
    
    d.appendChild(suggestionListDom);

    divS.appendChild(d);

    let inputS = document.createElement("input");
    inputS.className = "form-control";
    inputS.id = "search";
    inputS.placeholder = "Input and press enter to search ...";
    inputS.addEventListener("keydown", e => {
        if (e.key !== "Enter") {
            return;
        }
        removeAllChildren(suggestionListDom);
        if (e.target.value) {
            const results = searchEngine.search(e.target.value, {expand: true});
            filteredReports =  results.map(r => {return {...r.doc};});
            return buildReportList(main);
        } 
        filteredReports = [...reports];
        buildReportList(main);
    });

    inputS.addEventListener("input", e => {
        const keywords = e.target.value.split(" ");
        buildSuggestionList(keywords[keywords.length-1]);
    });
    d.appendChild(inputS);

    main.appendChild(divS);

    buildReportList(main);
    buildSearchIndex();
    buildSuggestWordIndex();
    window.addEventListener("keydown", ev => keyDownHandler(ev));
}

function buildSuggestionList(keyword) {
    removeAllChildren(suggestionListDom);
    const result = suggestWordSE.search(keyword,{expand: true});
    if (!result || result.length < 1) {
        return;
    }

    let min = Math.min(result.length, 10);

    for(let i=0;i<min;i++) {
        b = document.createElement("div");
        const kw = result[i].doc.word;
        b.innerHTML = "<strong>" + kw.substr(0, keyword.length) + "</strong>";
        b.innerHTML += kw.substr(keyword.length);
        b.innerHTML += "<input type='hidden' value='" + kw + "'>";
        b.addEventListener("click", function(e) {
            let searchDom = document.getElementById("search");
            let lastIndex = searchDom.value.lastIndexOf(keyword);
            searchDom.value = searchDom.value.substring(0, lastIndex) + this.getElementsByTagName("input")[0].value + " ";
            searchDom.focus();
            removeAllChildren(document.getElementById("search-autocomplete-list"));
        });
        suggestionListDom.appendChild(b);
    }
}

function buildReportList(main) {
    const root = document.getElementById("rp-list");
    if(root) {
        root.remove();
    }
    let div = document.createElement("div");
    div.className = "row rp-item";
    div.id = "rp-list";
    
    main.appendChild(div);

    if(!filteredReports || filteredReports.length < 1) {
        return;
    }

    let ul = document.createElement("ul");
    ul.className = "list-group";
    div.appendChild(ul);

    for(let i=0;i<filteredReports.length;i++) {
        const {id, content, tags} = {...filteredReports[i]};
        let li = document.createElement("li");  
        li.className = "list-group-item";

        let div = document.createElement("div");
        div.className = "row";
        div.innerHTML += "<input type='hidden' value='" + i + "'>";
        div.addEventListener("click", function (e) {
            openReportViewer(this.getElementsByTagName("input")[0].value);
        });

        let idCol = document.createElement("div");
        idCol.className="col-1 max-w-45";
        
        idCol.appendChild(document.createTextNode(`${id}`)); 

        let contentCol = document.createElement("div");
        contentCol.className = "col rp-content";
        contentCol.appendChild(document.createTextNode(content)); 
        div.appendChild(idCol);
        div.appendChild(contentCol);

        // If a report had at least 1 tag applied, show it on index page.
        // Otherwise, do not show tag column
        if(hasTagApplied()) {
            let tagCol = document.createElement("div");
            tagCol.className = "col-2";
            for(let i=0;i<tags.length;i++) {
                const tag = {...tags[i]};
                let span = document.createElement("span");
                span.className = `badge m-1 p-2  ${badgesType.get(tag.id)}`;
                // span.id = `${tag.id}`;
                span.innerText = tag.name;
                tagCol.appendChild(span);
            }
            div.appendChild(tagCol);
        }
        
        li.appendChild(div);
        ul.appendChild(li);
    }
}

// Check if at least one report had tag applied
function hasTagApplied() {
    return reports.findIndex(r => r.tags.length > 0) > -1;
}

// Build Index for Search Report Engine 
function buildSearchIndex() {
    for(let i=0;i<reports.length;i++) {
        searchEngine.addDoc(reports[i]);
    }
}

function updateRpContent(report) {
    const {id, content} = {...report};
    var rpContent = rpViewer.querySelector('#rp-content');
    buildRpTagList(report);
    bindDndEvent();
    rpContent.innerText = content;
}

function bindDndEvent() {
    var draggable = document.querySelectorAll('[draggable]')
    var targets = document.querySelectorAll('[data-drop-target]');

    for(var i = 0; i < draggable.length; i++) {
        draggable[i].addEventListener("dragstart", handleDragStart);
    }

    for(var i = 0; i < targets.length; i++) {
        targets[i].addEventListener("dragover", handleOverDrop);
        targets[i].addEventListener("drop", handleOverDrop);
    }
}

function buildRpTagList(report) {
    let tagListDom = document.getElementById("tag-list");
    removeAllChildren(tagListDom);

    tagList = tags.filter((t1) => !report.tags.some((t2) => t1.id === t2.id));
    
    if(tagList && tagList.length > 0) {
        for(let i=0;i<tagList.length;i++) {
            const tag = {...tagList[i]};
            let span = document.createElement("span");
            span.className = `badge m-1 p-2 ${badgesType.get(tag.id)}`;
            span.id = `${tag.id}`;
            span.setAttribute("draggable", true);
            span.innerText = tag.name;
            tagListDom.appendChild(span);
        }
    }    

    let rpTagList = document.getElementById("rp-tag-list");
    removeAllChildren(rpTagList);

    if(!report.tags || report.tags.length < 1) {
        return;
    }

    for(let i=0;i<report.tags.length;i++) {
        const tag = {...report.tags[i]};
        let span = document.createElement("span");
        span.className = `badge m-1 p-2  ${badgesType.get(tag.id)}`;
        span.id = `${tag.id}`;
        span.setAttribute("draggable", true);
        span.innerText = tag.name;

        rpTagList.appendChild(span);
    }
}

function toggleReportViewer() {
    viewMode = !viewMode;
    rpViewer.style.display = viewMode ? "block" : "none";
    main.style.display = viewMode ? "none" : "block";

    if(!viewMode) {
        buildReportList(main)
    }
}

function openReportViewer(id) {
    selectedIndex = parseInt(id);
    updateRpContent(filteredReports[selectedIndex]);
    toggleReportViewer();
}

function keyDownHandler(ev) {
    if(!viewMode) {
        return;
    }
    switch(ev.key) {
        case "1" :
            ev.preventDefault();
            addOrRemoveTag("tag-1");
            break;
        case "2" :
            ev.preventDefault();
            addOrRemoveTag("tag-2");
            break;
        case "ArrowLeft":
            ev.preventDefault();
            prevReport();
            break;
        case "ArrowRight":
            ev.preventDefault();
            nextReport();
            break;
        case "Escape": 
            ev.preventDefault();
            toggleReportViewer();
            break;
    }
}

function nextReport() {
    if ( selectedIndex < filteredReports.length -1) {
        updateRpContent(filteredReports[++selectedIndex]);
    }
}

function prevReport() {
    if (selectedIndex > 0) {
        updateRpContent(filteredReports[--selectedIndex]);
    }
}

function getTagByTagId(tagId) {
    return tags.find(t => t.id === tagId);
}

function removeTagFromCache(tagId) {
    filteredReports[selectedIndex].tags = filteredReports[selectedIndex].tags.filter(t => t.id !== tagId);
}

function addTagToCache(tagId) {
    if(isReportHasTag(filteredReports[selectedIndex], tagId)) {
        return;
    }
    filteredReports[selectedIndex].tags.push(getTagByTagId(tagId));
}

function isReportHasTag(report, tagId) {
    return report.tags.findIndex(t => t.id === tagId) > -1;
}

function addOrRemoveTag(tagId) {
    const rpTagList = document.getElementById('rp-tag-list');
    const tagList = document.getElementById('tag-list');
    const tag = document.getElementById(`${tagId}`);
    if (rpTagList.contains(tag)) {
        removeTag(rpTagList, tag);
        addTag(tagList, tag);
        removeTagFromCache(tagId);
    } else if (tagList.contains(tag)) {
        removeTag(tagList, tag);
        addTag(rpTagList, tag);
        addTagToCache(tagId);
    }
    updateData(filteredReports[selectedIndex]);
}

function addTag(container, tag) {
    container.appendChild(tag);
}

function removeTag(container, tag) {
    container.removeChild(tag);
}

function handleDragStart(e) {
    e.dataTransfer.setData("text", this.id); 
}

function handleOverDrop(e) {
    e.preventDefault(); 
    if (e.type != "drop") {
        return; 
    }
    var draggedId = e.dataTransfer.getData("text");
    var draggedEl = document.getElementById(draggedId);
    draggedEl.parentNode.removeChild(draggedEl);
    this.appendChild(draggedEl);
    if(this.id === "rp-tag-list") {
        addTagToCache(draggedId);
    } else if(this.id === "tag-list") {
        removeTagFromCache(draggedId);
    }
    updateData(filteredReports[selectedIndex]);
}

function removeAllChildren(parent) {
    while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }
}

function buildSuggestWordIndex(content) {
    let c = 1;
    let set = new Set();
    for(let i=0;i<reports.length;i++) {
        const {content} = {...reports[i]};
        const words = content.replaceAll("\n", "").split(" ");
        for(let j=0;j<words.length;j++) {
            const w = words[j];
            if(set.has(w)) {
                continue;
            }
            set.add(w);
            suggestWordSE.addDoc({
                id : c,
                word: w
            });
            c++;
        }
    }
}