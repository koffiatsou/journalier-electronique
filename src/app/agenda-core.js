/* =========================================================
   JOURNALIER V74 — AGENDA CORE ENGINE
   Extrait modulaire de journalier-core.js (Lot 3.6)
   - Modèle prévisionnel, récurrences hebdomadaires & exceptions
   - Vues Jour, Semaine, Mois, interactions Drag & Drop, redimensionnement
   - Modales de planification, duplication, annulation et suppression
   - Configuration personnalisée des 8 périodes scolaires
   ========================================================= */

(function (global) {
    /* Échappement HTML local et statique (5 caractères) : volontairement indépendant
       d'un éventuel helper global pour que l'analyse de sécurité puisse le vérifier. */
    const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function (ch) {
            return HTML_ENTITIES[ch];
        });
    }

const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
    const DEFAULT_AGENDA_PERIODS = [
        {id:'p1',label:'1e H',start:'08:00',end:'08:50'},
        {id:'p2',label:'2e H',start:'08:50',end:'09:40'},
        {id:'p3',label:'3e H',start:'09:40',end:'10:30'},
        {id:'p4',label:'4e H',start:'10:45',end:'11:35'},
        {id:'p5',label:'5e H',start:'11:35',end:'12:25'},
        {id:'p6',label:'6e H',start:'13:15',end:'14:05'},
        {id:'p7',label:'7e H',start:'14:05',end:'14:55'},
        {id:'p8',label:'8e H',start:'14:55',end:'15:45'}
    ];
    let agendaPeriodConfig = DEFAULT_AGENDA_PERIODS.map(p=>({...p}));
    let periods = agendaPeriodConfig.map(p=>p.label);

    let agendaMode = 'day';
    let agendaModalState = { mode:'create', eventId:null, recurrence:null, occurrenceDate:null };
    let agendaDeleteState = { eventId:null, seriesId:null, occurrenceDate:null, recurrence:null };
    function getInitialDateISO() {
        const now = new Date();
        if (isNaN(now.getTime())) return '2026-08-24';
        const iso = formatISO(now);
        return (iso >= '2026-08-24' && iso <= '2027-07-02') ? iso : '2026-08-24';
    }
    let selectedDateISO = getInitialDateISO();

    function parseISODate(isoStr) {
        const fallback = new Date(2026, 7, 24);
        if (!isoStr || typeof isoStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return fallback;
        const [y,m,d] = isoStr.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return fallback;
        return dt;
    }

    function formatISO(d) {
        if (!(d instanceof Date) || isNaN(d.getTime())) return '2026-08-24';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function getMonday(d) {
        let dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        let day = dt.getDay();
        let diff = dt.getDate() - day + (day === 0 ? -6 : 1);
        let monday = new Date(dt.setDate(diff));
        return monday;
    }

    function normalizeAgendaConfig(config){
        const source=Array.isArray(config)?config:(Array.isArray(config?.periods)?config.periods:DEFAULT_AGENDA_PERIODS);
        const out=[];
        let previousEndMin=-1;
        for(let i=0;i<8;i++){
            const fallback=DEFAULT_AGENDA_PERIODS[i];
            const raw=source[i]||{};
            let sRaw=String(raw.start||'').trim();
            let eRaw=String(raw.end||'').trim();
            if(/^\d:\d{2}$/.test(sRaw))sRaw='0'+sRaw;
            if(/^\d:\d{2}$/.test(eRaw))eRaw='0'+eRaw;
            const startMin=agendaTimeToMinutes(sRaw);
            const endMin=agendaTimeToMinutes(eRaw);
            const valid=startMin>=0&&endMin>startMin&&startMin>=previousEndMin;
            let chosenStart=valid?sRaw:fallback.start;
            let chosenEnd=valid?eRaw:fallback.end;
            if(agendaTimeToMinutes(chosenStart)<previousEndMin){
                chosenStart=agendaMinutesToTime(previousEndMin);
                chosenEnd=agendaMinutesToTime(previousEndMin+50);
            }
            out.push({id:`p${i+1}`,label:fallback.label,start:chosenStart,end:chosenEnd});
            previousEndMin=agendaTimeToMinutes(chosenEnd);
        }
        return out;
    }

    function applyAgendaPeriodConfig(config){
        agendaPeriodConfig=normalizeAgendaConfig(config);
        periods=agendaPeriodConfig.map(p=>p.label);
        return agendaPeriodConfig;
    }

    function agendaPeriodByLabel(label){
        return agendaPeriodConfig.find(p=>p.label===label)||null;
    }

    function agendaTimesFromPeriods(startPeriodLabel,endPeriodLabel,dateIso){
        const p1=agendaPeriodByLabel(startPeriodLabel)||agendaPeriodConfig[0];
        const p2=agendaPeriodByLabel(endPeriodLabel)||p1;
        const iso=/^\d{4}-\d{2}-\d{2}$/.test(String(dateIso||''))?dateIso:'2026-09-01';
        return {
            startDateTime:`${iso}T${p1.start}:00`,
            endDateTime:`${iso}T${p2.end}:00`,
            startPeriod:p1.label,
            endPeriod:p2.label,
            timezone:'Europe/Brussels'
        };
    }

    function agendaPeriodsFromTimes(startTimeHHMM,endTimeHHMM){
        const sMin=agendaTimeToMinutes(startTimeHHMM),eMin=agendaTimeToMinutes(endTimeHHMM);
        if(sMin<0||eMin<=sMin){
            return {startPeriod:agendaPeriodConfig[0].label,endPeriod:agendaPeriodConfig[0].label};
        }
        let bestStart=null,bestEnd=null;
        for(let i=0;i<agendaPeriodConfig.length;i++){
            const p=agendaPeriodConfig[i];
            const pStart=agendaTimeToMinutes(p.start),pEnd=agendaTimeToMinutes(p.end);
            if(sMin<pEnd&&eMin>pStart){
                if(!bestStart)bestStart=p;
                bestEnd=p;
            }
        }
        if(!bestStart){
            if(sMin<=agendaTimeToMinutes(agendaPeriodConfig[0].start)){
                bestStart=agendaPeriodConfig[0];
            }else{
                for(let i=0;i<agendaPeriodConfig.length;i++){
                    const p=agendaPeriodConfig[i];
                    if(sMin<=agendaTimeToMinutes(p.end)){bestStart=p;break;}
                }
            }
        }
        if(!bestStart)bestStart=agendaPeriodConfig[agendaPeriodConfig.length-1]||agendaPeriodConfig[0];
        if(!bestEnd)bestEnd=bestStart||agendaPeriodConfig[0];
        return {startPeriod:bestStart.label,endPeriod:bestEnd.label};
    }

    /**
     * Convertit une heure au format "HH:MM" en nombre total de minutes depuis minuit.
     * Retourne -1 si le format est invalide.
     * @param {string} value
     * @returns {number}
     */
    function agendaTimeToMinutes(value){
        const m=/^(\d{2}):(\d{2})$/.exec(String(value||''));
        return m?Number(m[1])*60+Number(m[2]):-1;
    }

    /**
     * Convertit un nombre de minutes depuis minuit en chaîne "HH:MM".
     * Complémentaire à agendaTimeToMinutes.
     * @param {number} totalMinutes
     * @returns {string}
     */
    function agendaMinutesToTime(totalMinutes) {
        if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return '00:00';
        const h = Math.floor(totalMinutes / 60) % 24;
        const m = Math.floor(totalMinutes % 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    function agendaEventIndexes(event){
        const start=periodIndex(event?.startPeriod), end=periodIndex(event?.endPeriod||event?.startPeriod);
        return {startIndex:start,endIndex:end};
    }

    function normalizeAgendaEvent(item,ownerId,defaults={}){
        const ev={...(item||{})};
        for(const transientKey of ['occurrenceDate','startIndex','endIndex','_sMin','_eMin','lane','historySessionId','virtualHistoryEvent'])delete ev[transientKey];
        ev.eventId=String(ev.eventId||journalierUuid('evt'));
        ev.ownerId=ownerId||ev.ownerId||null;
        ev.dataVersion=JOURNALIER_ARCHITECTURE_VERSION;
        const validRecurrences=['unique','daily','weekly','monthly','yearly'];
        if(item?.recurrence&&typeof item.recurrence==='object'&&!Array.isArray(item.recurrence)){
            const graphPat=item.recurrence.pattern||{};
            const graphRng=item.recurrence.range||{};
            const pType=String(graphPat.type||'weekly');
            ev.recurrence=pType.includes('Month')?'monthly':(pType.includes('Year')?'yearly':(validRecurrences.includes(pType)?pType:'weekly'));
            if(!item.recurrencePattern)item={...item,recurrencePattern:graphPat};
            if(!item.recurrenceRange)item={...item,recurrenceRange:graphRng};
        }else{
            ev.recurrence=validRecurrences.includes(ev.recurrence)?ev.recurrence:'weekly';
        }
        if(ev.recurrence==='unique')ev.seriesId=null;
        else ev.seriesId=String(ev.seriesId||ev.eventId);
        ev.type=['ELEVE','COLLAB','FORMATION','ADMIN','LIBRE'].includes(ev.type)?ev.type:'ADMIN';
        ev.eleve=ev.eleve!=null?String(ev.eleve):'';
        ev.eleveId=ev.eleveId!=null?String(ev.eleveId):'';
        ev.matiere=ev.matiere!=null?String(ev.matiere):'';
        ev.title=ev.title!=null?String(ev.title):'';
        ev.detail=ev.detail!=null?String(ev.detail):'';
        ev.local=ev.local!=null?String(ev.local):'';
        ev.dayIndex=Number.isInteger(Number(ev.dayIndex))?Number(ev.dayIndex):Number(defaults.dayIndex??0);
        if(ev.dayIndex<0||ev.dayIndex>6)ev.dayIndex=0;
        ev.date=ev.date?String(ev.date):(defaults.date||'');
        ev.startPeriod=periods.includes(ev.startPeriod)?ev.startPeriod:(defaults.startPeriod||periods[0]);
        ev.endPeriod=periods.includes(ev.endPeriod)?ev.endPeriod:ev.startPeriod;
        if(periodIndex(ev.endPeriod)<periodIndex(ev.startPeriod))ev.endPeriod=ev.startPeriod;
        ev.timezone=ev.timezone?String(ev.timezone):'Europe/Brussels';
        const anchorDate=ev.date||defaults.date||'2026-09-01';
        if(ev.startDateTime&&ev.endDateTime){
            const sTime=ev.startDateTime.split('T')[1]?.slice(0,5);
            const eTime=ev.endDateTime.split('T')[1]?.slice(0,5);
            if(sTime&&eTime){
                const deduced=agendaPeriodsFromTimes(sTime,eTime);
                if(!ev.startPeriod||!periods.includes(ev.startPeriod))ev.startPeriod=deduced.startPeriod;
                if(!ev.endPeriod||!periods.includes(ev.endPeriod))ev.endPeriod=deduced.endPeriod;
            }
        }
        const pStart=agendaPeriodByLabel(ev.startPeriod)||agendaPeriodConfig[0];
        const pEnd=agendaPeriodByLabel(ev.endPeriod)||pStart;
        if(!ev.startDateTime)ev.startDateTime=`${anchorDate}T${pStart.start}:00`;
        if(!ev.endDateTime)ev.endDateTime=`${anchorDate}T${pEnd.end}:00`;
        if(item?.recurrencePattern&&typeof item.recurrencePattern==='object'){
            const pat=item.recurrencePattern;
            const normPat={
                type:pat.type||ev.recurrence,
                interval:Math.max(1,Number(pat.interval)||1)
            };
            if(Array.isArray(pat.daysOfWeek))normPat.daysOfWeek=pat.daysOfWeek;
            else if(ev.recurrence==='weekly')normPat.daysOfWeek=[ev.dayIndex];
            if(pat.dayOfMonth!=null)normPat.dayOfMonth=Number(pat.dayOfMonth);
            if(pat.index&&['first','second','third','fourth','last'].includes(pat.index))normPat.index=pat.index;
            if(pat.month!=null)normPat.month=Number(pat.month);
            if(pat.firstDayOfWeek)normPat.firstDayOfWeek=String(pat.firstDayOfWeek);
            ev.recurrencePattern=normPat;
        }
        if(item?.recurrenceRange&&typeof item.recurrenceRange==='object'){
            const rType=['noEnd','endDate','count','numbered'].includes(item.recurrenceRange.type)?(item.recurrenceRange.type==='numbered'?'count':item.recurrenceRange.type):'noEnd';
            ev.recurrenceRange={type:rType,startDate:item.recurrenceRange.startDate||anchorDate,endDate:item.recurrenceRange.endDate||null,numberOfOccurrences:item.recurrenceRange.numberOfOccurrences?Number(item.recurrenceRange.numberOfOccurrences):null};
        }
        const defaultStatus=defaults.status||'proposed';
        const rawStatus=ev.eventStatus==='confirmed'?'proposed':ev.eventStatus;
        ev.eventStatus=['proposed','realized','cancelled'].includes(rawStatus)?rawStatus:defaultStatus;
        ev.realized=Boolean(ev.realized||ev.eventStatus==='realized');
        ev.realizedAt=ev.realizedAt?String(ev.realizedAt):null;
        if(ev.realized&&!ev.realizedAt)ev.realizedAt=new Date().toISOString();
        ev.createdAt=ev.createdAt?String(ev.createdAt):new Date().toISOString();
        ev.updatedAt=new Date().toISOString();
        const o=ev.outlook&&typeof ev.outlook==='object'&&!Array.isArray(ev.outlook)?ev.outlook:{};
        ev.outlook={calendarId:o.calendarId?String(o.calendarId):null,eventId:o.eventId?String(o.eventId):null,iCalUId:o.iCalUId?String(o.iCalUId):null,changeKey:o.changeKey?String(o.changeKey):null,webLink:o.webLink?String(o.webLink):null};
        if(ev.recurrence==='weekly'&&!ev.date)ev.date='';
        return ev;
    }

    function legacyAgendaEvents(source,ownerId){
        const events=[];
        const slots=[];
        Object.entries(source||{}).forEach(([key,value])=>{
            if(key==='__uniqueEvents'||key==='__exceptions'||key==='__config'||key==='__events')return;
            if(!/^\d+_.+$/.test(key)||!value||typeof value!=='object'||Array.isArray(value))return;
            const [dayRaw,...rest]=key.split('_');
            const dayIndex=Number(dayRaw),period=rest.join('_');
            if(dayIndex<0||dayIndex>4||!periods.includes(period))return;
            slots.push({key,dayIndex,period,value});
        });
        const grouped=new Map();
        for(const slot of slots){
            const explicitId=slot.value.eventId?String(slot.value.eventId):'';
            const contentKey=JSON.stringify([
                slot.value.type||'',slot.value.eleveId||'',slot.value.eleve||'',slot.value.matiere||'',
                slot.value.title||'',slot.value.detail||'',slot.value.local||''
            ]);
            const key=`${slot.dayIndex}|${explicitId?`id:${explicitId}`:`content:${contentKey}`}`;
            if(!grouped.has(key))grouped.set(key,[]);
            grouped.get(key).push(slot);
        }
        for(const group of grouped.values()){
            group.sort((a,b)=>periodIndex(a.period)-periodIndex(b.period));
            let run=[];let previous=-2;
            const flush=()=>{
                if(!run.length)return;
                const first=run[0],last=run[run.length-1];
                const base={...first.value,eventId:first.value.eventId||`legacy_${first.dayIndex}_${first.period}_${journalierUuid('x')}`,dayIndex:first.dayIndex,startPeriod:first.period,endPeriod:last.period,recurrence:'weekly',seriesId:first.value.seriesId||first.value.eventId||null};
                events.push(normalizeAgendaEvent(base,ownerId,{dayIndex:first.dayIndex,startPeriod:first.period,status:'proposed'}));
                run=[];
            };
            for(const slot of group){
                const idx=periodIndex(slot.period);
                if(idx!==previous+1)flush();
                run.push(slot);previous=idx;
            }
            flush();
        }
        return events;
    }

    function normalizeAgendaData(prev,ownerId=JournalierSecurity.accountKey){
        const source=prev&&typeof prev==='object'?prev:{};
        const config=normalizeAgendaConfig(source.__config);
        applyAgendaPeriodConfig(config);
        const out={__events:[],__exceptions:{},__config:{version:2,periods:config.map(p=>({...p}))}};
        if(source.__exceptions&&typeof source.__exceptions==='object'&&!Array.isArray(source.__exceptions))out.__exceptions=JSON.parse(JSON.stringify(source.__exceptions));
        const seen=new Set();
        const push=(item,defaults)=>{
            const ev=normalizeAgendaEvent(item,ownerId,defaults);
            if(!seen.has(ev.eventId)){seen.add(ev.eventId);out.__events.push(ev);}
        };
        if(Array.isArray(source.__events))source.__events.forEach(ev=>push(ev,{status:'proposed'}));
        if(Array.isArray(source.__uniqueEvents))source.__uniqueEvents.forEach(ev=>push({...ev,recurrence:'unique',date:ev.date||ev.occurrenceDate},{status:'proposed'}));
        legacyAgendaEvents(source,ownerId).forEach(ev=>push(ev,{status:'proposed'}));
        out.__events.sort((a,b)=>String(a.date||a.dayIndex).localeCompare(String(b.date||b.dayIndex))||periodIndex(a.startPeriod)-periodIndex(b.startPeriod)||a.eventId.localeCompare(b.eventId));
        return out;
    }

    function normalizePrevisionnel(prev){
        return normalizeAgendaData(prev,JournalierSecurity.accountKey);
    }

    function getPrevisionnel(){return normalizePrevisionnel(DataStore.getAgenda());}

    async function savePrevisionnel(prev){
        const candidate=normalizePrevisionnel(prev||{});
        const persistPromise=DataStore.saveAgenda(candidate);
        const persisted=normalizePrevisionnel(DataStore.getAgenda());
        renderAgenda();
        await persistPromise;
        return persisted;
    }

    function updateStudentDropdowns(){
        const students=getStudents();
        ['f-eleve','r-eleve','modal-slot-eleve'].forEach(id=>{
            const el=document.getElementById(id);if(!el)return;
            const current=el.value;el.replaceChildren();
            const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='-- Choisir un élève --';el.appendChild(placeholder);
            students.forEach(s=>{const o=document.createElement('option');o.value=String(s.nom??'');o.textContent=`${s.nom??''} (${s.classe??''}${s.ecole?' - '+s.ecole:''})`;el.appendChild(o);});
            if(current)el.value=current;
        });
    }

    function prepareEditingStudentSelection(entry){
        const select=document.getElementById('f-eleve');
        if(!select)return;
        const students=getStudents();
        const originalName=String(entry?.identification?.eleve||'').trim();
        const originalId=String(entry?.identification?.eleveId||'').trim();
        const currentStudent=students.find(s=>originalId&&String(s.studentId)===originalId)
            ||students.find(s=>originalName&&String(s.nom)===originalName)
            ||null;

        const note=document.getElementById('session-student-edit-note');
        if(currentStudent){
            select.value=String(currentStudent.nom||'');
            select.removeAttribute('data-orphan-session-student');
            if(note){note.textContent='';note.classList.add('hidden');}
            return currentStudent;
        }

        if(!originalName)return null;
        let option=Array.from(select.options).find(o=>String(o.value)===originalName);
        if(!option){
            option=document.createElement('option');
            option.value=originalName;
            option.textContent=`${originalName} · ancien élève — choisissez un élève actuel`;
            option.dataset.orphanSessionStudent='true';
            select.insertBefore(option,select.options[1]||null);
        }
        option.dataset.orphanSessionStudent='true';
        select.value=originalName;
        select.setAttribute('data-orphan-session-student','true');
        if(note){note.textContent='Cette séance était rattachée à un élève qui n’existe plus dans le dossier. Choisissez l’élève actuel avant d’enregistrer.';note.classList.remove('hidden');}
        return null;
    }

    function getTodayInApp(){
        const now=new Date();let iso=formatISO(now);if(iso<'2026-08-24'||iso>'2027-07-02')iso=selectedDateISO;return iso;
    }

    function eventOccursOnDate(event,iso,prev=null){
        if(!event)return false;
        const seriesKey=String(event.seriesId||event.eventId||'');
        const excluded=prev?.__exceptions?.[seriesKey];
        if(Array.isArray(excluded)&&excluded.includes(iso))return false;
        if(event.recurrence==='unique')return event.date===iso;
        const range=event.recurrenceRange;
        const startAnchor=range?.startDate||event.date||'2026-08-24';
        if(range){
            if(range.startDate&&iso<range.startDate)return false;
            if(range.type==='endDate'&&range.endDate&&iso>range.endDate)return false;
        }
        const maxOccurrences=(range?.type==='count'||range?.type==='numbered')?(Number(range.numberOfOccurrences)||10):Infinity;
        const dayIdx=getDayIndexFromISO(iso);
        const interval=Math.max(1,Number(event.recurrencePattern?.interval)||1);
        if(event.recurrence==='daily'){
            const daysDiff=Math.round((parseISODate(iso)-parseISODate(startAnchor))/(1000*60*60*24));
            if(daysDiff<0||daysDiff%interval!==0)return false;
            const occIndex=Math.floor(daysDiff/interval);
            return occIndex<maxOccurrences;
        }
        if(event.recurrence==='weekly'){
            const daysOfWeek=event.recurrencePattern?.daysOfWeek;
            const graphDays=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
            const normalizedDays=Array.isArray(daysOfWeek)&&daysOfWeek.length>0?daysOfWeek.map(d=>{
                if(typeof d==='string'){
                    const idx=graphDays.indexOf(d.toLowerCase());
                    return idx>=0?idx:Number(d);
                }
                return Number(d);
            }):[Number(event.dayIndex)];
            const matchesDay=normalizedDays.includes(dayIdx);
            if(!matchesDay)return false;
            const mondayStart=getMonday(parseISODate(startAnchor)),mondayCurrent=getMonday(parseISODate(iso));
            const weeksDiff=Math.round((mondayCurrent-mondayStart)/(1000*60*60*24*7));
            if(weeksDiff<0||weeksDiff%interval!==0)return false;
            if(maxOccurrences<Infinity){
                const sortedDays=[...new Set(normalizedDays)].sort((a,b)=>a-b);
                const startDayIdx=getDayIndexFromISO(startAnchor);
                let count=0;
                for(let w=0;w<=weeksDiff;w+=interval){
                    for(const dIdx of sortedDays){
                        if(w===0&&dIdx<startDayIdx)continue;
                        if(w===weeksDiff&&dIdx>dayIdx)continue;
                        count++;
                    }
                }
                return count<=maxOccurrences;
            }
            return true;
        }
        if(event.recurrence==='monthly'){
            const d=parseISODate(iso),dStart=parseISODate(startAnchor);
            const monthsDiff=(d.getFullYear()-dStart.getFullYear())*12+(d.getMonth()-dStart.getMonth());
            if(monthsDiff<0||monthsDiff%interval!==0)return false;
            const patIndex=event.recurrencePattern?.index;
            if(patIndex&&['first','second','third','fourth','last'].includes(patIndex)){
                const graphDays=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
                const rawTarget=Array.isArray(event.recurrencePattern?.daysOfWeek)&&event.recurrencePattern.daysOfWeek.length>0?event.recurrencePattern.daysOfWeek[0]:event.dayIndex;
                const fallbackDow=dStart.getDay()===0?6:dStart.getDay()-1;
                const targetDayIdx=typeof rawTarget==='string'?(graphDays.indexOf(rawTarget.toLowerCase())>=0?graphDays.indexOf(rawTarget.toLowerCase()):Number(rawTarget)):Number(rawTarget??fallbackDow);
                if(dayIdx!==targetDayIdx)return false;
                const dom=d.getDate();
                const lastDom=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
                let matchesIndex=false;
                if(patIndex==='first')matchesIndex=dom>=1&&dom<=7;
                else if(patIndex==='second')matchesIndex=dom>=8&&dom<=14;
                else if(patIndex==='third')matchesIndex=dom>=15&&dom<=21;
                else if(patIndex==='fourth')matchesIndex=dom>=22&&dom<=28;
                else if(patIndex==='last')matchesIndex=dom>lastDom-7;
                if(!matchesIndex)return false;
            }else{
                const anchorDay=Number(event.recurrencePattern?.dayOfMonth||(event.date?parseISODate(event.date).getDate():dStart.getDate()));
                if(d.getDate()!==anchorDay)return false;
            }
            const occIndex=Math.floor(monthsDiff/interval);
            return occIndex<maxOccurrences;
        }
        if(event.recurrence==='yearly'){
            const d=parseISODate(iso),dStart=parseISODate(startAnchor);
            const targetMonth=event.recurrencePattern?.month!=null?Number(event.recurrencePattern.month)-1:dStart.getMonth();
            const targetDom=event.recurrencePattern?.dayOfMonth!=null?Number(event.recurrencePattern.dayOfMonth):dStart.getDate();
            if(d.getMonth()!==targetMonth||d.getDate()!==targetDom)return false;
            const yearsDiff=d.getFullYear()-dStart.getFullYear();
            if(yearsDiff<0||yearsDiff%interval!==0)return false;
            const occIndex=Math.floor(yearsDiff/interval);
            return occIndex<maxOccurrences;
        }
        return false;
    }

    function getEventsForDate(iso,prev=getPrevisionnel()){
        const db=getDB();
        const base=(prev.__events||[])
            .filter(ev=>eventOccursOnDate(ev,iso,prev))
            .map(ev=>({...ev,occurrenceDate:iso,...agendaEventIndexes(ev)}));

        // L'Historique est la preuve de réalisation d'une séance.
        // On projette donc chaque séance enregistrée dans l'Agenda :
        // - si un événement planifié correspond exactement au créneau, celui-ci
        //   devient Réalisé dans la vue ;
        // - sinon, une occurrence réalisée est ajoutée uniquement à l'affichage.
        const history=db.filter(item=>{
            if(!isJournalSession(item))return false;
            return sessionParts(item).date===iso;
        });

        history.forEach(item=>{
            const sp=sessionParts(item);
            const start=periodIndex(sp.start),end=periodIndex(sp.end||sp.start);
            if(start<0||end<0)return;

            const candidates=base.filter(ev=>{
                if(ev.type!=='ELEVE'||ev.eventStatus==='cancelled')return false;
                if(ev.eleve!==sp.eleve)return false;
                if(ev.eleveId&&item.identification?.eleveId&&String(ev.eleveId)!==String(item.identification.eleveId))return false;
                if(ev.matiere&&sp.matiere&&ev.matiere!==sp.matiere)return false;
                return ev.startIndex===start&&ev.endIndex===end;
            });

            // Une seule proposition est transformée visuellement en Réalisé.
            // L'identifiant déterministe évite qu'une séance marque plusieurs
            // propositions chevauchantes comme réalisées.
            // Une seule proposition correspondante peut être projetée comme réalisée.
            // En présence de plusieurs propositions concurrentes, on ne choisit jamais
            // arbitrairement laquelle a été exécutée : l'Historique reste la preuve
            // de réalisation et une occurrence dédiée est créée pour l'affichage.
            const target=candidates.length===1?candidates[0]:null;
            if(target){
                target.eventStatus='realized';
                target.realized=true;
                target.realizedAt=target.realizedAt||item.metadata?.updatedAt||item.metadata?.createdAt||null;
                target.historySessionId=String(item.id);
                return;
            }

            // Aucun événement planifié correspondant, ou plusieurs propositions
            // concurrentes : la séance reste visible comme occurrence réalisée
            // indépendante dans les vues jour/semaine/mois.
            const virtualId=`history_${String(item.id)}`;
            if(base.some(ev=>String(ev.eventId)===virtualId))return;
            base.push({
                eventId:virtualId,
                ownerId:JournalierSecurity.accountKey,
                dataVersion:JOURNALIER_ARCHITECTURE_VERSION,
                recurrence:'unique',
                seriesId:null,
                type:'ELEVE',
                eleve:sp.eleve,
                eleveId:String(item.identification?.eleveId||''),
                matiere:sp.matiere,
                title:'',
                detail:'',
                local:'',
                dayIndex:getDayIndexFromISO(iso),
                date:iso,
                startPeriod:sp.start,
                endPeriod:sp.end||sp.start,
                eventStatus:'realized',
                realized:true,
                realizedAt:item.metadata?.updatedAt||item.metadata?.createdAt||null,
                createdAt:item.metadata?.createdAt||null,
                updatedAt:item.metadata?.updatedAt||null,
                timezone:'Europe/Brussels',
                outlook:{calendarId:null,eventId:null,iCalUId:null,changeKey:null,webLink:null},
                occurrenceDate:iso,
                ...agendaEventIndexes({startPeriod:sp.start,endPeriod:sp.end||sp.start}),
                historySessionId:String(item.id),
                virtualHistoryEvent:true
            });
        });

        return base;
    }

    function getEventsForDatePeriod(iso,period,prev=getPrevisionnel()){
        const pIdx=periodIndex(period);
        return getEventsForDate(iso,prev).filter(ev=>pIdx>=ev.startIndex&&pIdx<=ev.endIndex);
    }

    function findAgendaEventForOccurrence(iso,eventId,prev=getPrevisionnel()){
        return getEventsForDate(iso,prev).find(ev=>String(ev.eventId)===String(eventId))||null;
    }

    function getEventForDatePeriod(iso,period,prev=getPrevisionnel()){
        return getEventsForDatePeriod(iso,period,prev)[0]||null;
    }

    function getEventLabel(event){
        if(!event)return 'Activité';
        if(event.type==='ELEVE')return event.eleve||'Accompagnement élève';
        if(event.type==='FORMATION')return event.title||'Formation';
        if(event.type==='COLLAB')return event.title||'Collaboration';
        if(event.type==='ADMIN')return event.title||'Tâche administrative';
        return event.title||'Créneau libre';
    }

    function getEventMeta(event){
        if(!event)return '';
        if(event.type==='ELEVE')return [event.matiere,event.local].filter(Boolean).join(' · ');
        return event.detail||'';
    }

    function getEventState(event,dayIdx,iso,db){
        if(event?.eventStatus==='cancelled')return {key:'cancelled',label:'Annulé'};
        if(event?.realized||event?.eventStatus==='realized'){
            const encoded=event?.historySessionId?(db||[]).find(item=>String(item.id)===String(event.historySessionId))||null:null;
            return {key:'realized',label:encoded?'Séance enregistrée':'Réalisé',encoded};
        }
        return {key:'proposed',label:'Planifié'};
    }

    function getEventClass(event,state){
        if(state?.key==='realized')return 'event-encoded';
        if(state?.key==='cancelled')return 'event-cancelled';
        if(event?.type==='FORMATION')return 'event-formation';
        if(event?.type==='COLLAB')return 'event-collab';
        if(event?.type==='ADMIN')return 'event-admin';
        return 'event-eleve';
    }

    function getEncodedForEvent(dayIdx,isoDate,event,db){
        if(!event||event.type!=='ELEVE')return null;

        // Une projection issue de l'Historique possède un lien direct.
        // Il est prioritaire sur toute recherche heuristique par élève/date/créneau.
        if(event.historySessionId){
            const linked=(db||[]).find(item=>String(item.id)===String(event.historySessionId));
            if(linked)return linked;
        }

        const {startIndex,endIndex}=agendaEventIndexes(event);
        const matches=(db||[]).filter(item=>{
            const sp=sessionParts(item);
            if(sp.date!==isoDate)return false;
            if(event.eleveId&&item.identification?.eleveId&&String(event.eleveId)!==String(item.identification.eleveId))return false;
            if(sp.eleve!==event.eleve)return false;
            if(event.matiere&&sp.matiere&&sp.matiere!==event.matiere)return false;
            const itemStart=periodIndex(sp.start),itemEnd=periodIndex(sp.end||sp.start);
            if(itemStart<0||itemEnd<0)return false;
            return itemStart<=endIndex&&itemEnd>=startIndex;
        });
        return matches.sort((a,b)=>sessionSortKey(b).localeCompare(sessionSortKey(a)))[0]||null;
    }

    function renderHome(){
        const iso=getTodayInApp(),dt=parseISODate(iso),label=dt.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
        const dateEl=document.getElementById('home-today-date');if(dateEl)dateEl.textContent=label.charAt(0).toUpperCase()+label.slice(1);
        const list=document.getElementById('home-today-list');if(!list)return;
        const db=getDB(),events=getEventsForDate(iso),pending=[];
        if(getDayIndexFromISO(iso)>4){list.innerHTML='<div class="home-empty">Aucune journée scolaire dans la période actuelle.</div>';}
        else{
            const seen=new Set();let html='';
            events.sort((a,b)=>a.startIndex-b.startIndex||a.endIndex-b.endIndex).forEach(ev=>{
                if(seen.has(ev.eventId))return;seen.add(ev.eventId);
                const state=getEventState(ev,getDayIndexFromISO(iso),iso,db);
                if(ev.type==='ELEVE'&&state.key!=='realized')pending.push(ev);
                const range=ev.startPeriod===ev.endPeriod?ev.startPeriod:`${ev.startPeriod} → ${ev.endPeriod}`;
                html+=`<div class="home-row js-home-event" data-iso="${escapeHtml(iso)}" data-start-period="${escapeHtml(ev.startPeriod)}" data-day-index="${getDayIndexFromISO(iso)}" data-event-id="${escapeHtml(ev.eventId)}"><div class="home-period">${escapeHtml(range)}</div><div><div class="home-event-title">${escapeHtml(getEventLabel(ev))}</div><div class="home-event-meta">${escapeHtml(getEventMeta(ev)||'Mission Pôle Territorial')}</div></div><span class="status-badge agenda-status-${state.key}">${escapeHtml(state.label)}</span></div>`;
            });
            list.innerHTML=html||'<div class="home-empty">Aucun événement planifié aujourd’hui.</div>';
        }
        const countEl=document.getElementById('home-pending-count');if(countEl)countEl.textContent=pending.length;
        const task=document.getElementById('home-task-list');if(task)task.innerHTML=pending.slice(0,5).map(ev=>`<li><strong>${escapeHtml(ev.eleve)}</strong> · ${escapeHtml(ev.startPeriod)}${ev.endPeriod!==ev.startPeriod?' → '+escapeHtml(ev.endPeriod):''} · ${escapeHtml(ev.matiere||'')}</li>`).join('')||'<li>Rien à traiter pour le moment.</li>';
    }

    function switchAgendaView(mode){agendaMode=['day','week','month'].includes(mode)?mode:'day';['day','week','month'].forEach(m=>document.getElementById(`vbtn-${m}`)?.classList.toggle('active',m===agendaMode));renderAgenda();}
    function todayAgenda(){selectedDateISO=getTodayInApp();renderAgenda();}
    function navigateAgenda(delta){const d=parseISODate(selectedDateISO);if(agendaMode==='day')d.setDate(d.getDate()+delta);else if(agendaMode==='week')d.setDate(d.getDate()+delta*7);else d.setMonth(d.getMonth()+delta);selectedDateISO=formatISO(d);renderAgenda();}
    function pickerDateChanged(val){if(!val)return;selectedDateISO=val;renderAgenda();}

    function renderAgenda(){
        const picker=document.getElementById('agenda-picker-input');if(picker)picker.value=selectedDateISO;
        const reportDate=document.getElementById('r-date-anchor');if(reportDate)reportDate.value=selectedDateISO;
        ['day','week','month'].forEach(m=>document.getElementById(`agenda-view-${m}`)?.classList.toggle('hidden',m!==agendaMode));
        if(agendaMode==='day')renderDayView();else if(agendaMode==='week')renderWeekView();else renderMonthView();
    }

    function getTimelineRange(events=[]){
        const minConfigStart=Math.min(...agendaPeriodConfig.map(p=>agendaTimeToMinutes(p.start)));
        const maxConfigEnd=Math.max(...agendaPeriodConfig.map(p=>agendaTimeToMinutes(p.end)));
        let startMin=minConfigStart>=0?minConfigStart:480;
        let endMin=maxConfigEnd>0?maxConfigEnd:945;
        events.forEach(ev=>{
            if(ev.startDateTime){
                const m=agendaTimeToMinutes(ev.startDateTime.split('T')[1]?.slice(0,5));
                if(m>=0&&m<startMin)startMin=Math.floor(m/30)*30;
            }
            if(ev.endDateTime){
                const m=agendaTimeToMinutes(ev.endDateTime.split('T')[1]?.slice(0,5));
                if(m>0&&m>endMin)endMin=Math.ceil(m/30)*30;
            }
        });
        startMin=Math.floor(startMin/30)*30;
        endMin=Math.ceil(endMin/30)*30;
        const totalMin=Math.max(60,endMin-startMin);
        return {startMin,endMin,totalMin};
    }

    function getEventStartEndMinutes(ev){
        const sMin=ev?.startDateTime?agendaTimeToMinutes(ev.startDateTime.split('T')[1]?.slice(0,5)):agendaTimeToMinutes(agendaPeriodByLabel(ev?.startPeriod)?.start||'08:00');
        const eMin=ev?.endDateTime?agendaTimeToMinutes(ev.endDateTime.split('T')[1]?.slice(0,5)):agendaTimeToMinutes(agendaPeriodByLabel(ev?.endPeriod)?.end||'08:50');
        return {sMin,eMin};
    }

    function computeEventTimelineLanes(events=[]){
        const laneEnds=[];
        events.forEach(ev=>{
            const {sMin,eMin}=getEventStartEndMinutes(ev);
            ev._sMin=sMin; ev._eMin=eMin;
            let lane=laneEnds.findIndex(end=>end<=sMin);
            if(lane<0)lane=laneEnds.length;
            ev.lane=lane;
            laneEnds[lane]=eMin;
        });
        return Math.max(1,laneEnds.length);
    }

    function renderDayView(){
        const dt=parseISODate(selectedDateISO),label=dt.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
        document.getElementById('agenda-date-label').innerText=label.charAt(0).toUpperCase()+label.slice(1);
        const dayView=document.getElementById('agenda-view-day'),db=getDB(),prev=getPrevisionnel(),dayIdx=getDayIndexFromISO(selectedDateISO);
        const events=getEventsForDate(selectedDateISO,prev).sort((a,b)=>a.startIndex-b.startIndex||a.endIndex-b.endIndex||a.eventId.localeCompare(b.eventId));

        const {startMin,endMin,totalMin}=getTimelineRange(events);
        const timelineHeight=Math.max(680,Math.round(totalMin*1.3));
        const laneCount=computeEventTimelineLanes(events);

        let html=dayIdx>4?'<div class="day-weekend-note" style="padding:4px 0 8px;color:#64748b;font-size:.78rem;">Week-end : seuls les événements uniques sont affichés.</div>':'';
        html+=`<div class="day-timeline-layout" style="height:${Number(timelineHeight)}px;">`;

        html+=`<div class="timeline-time-col">`;
        let prevEndMin=-1;
        let prevEndStr='';
        agendaPeriodConfig.forEach((p,index)=>{
            const pStartMin=agendaTimeToMinutes(p.start);
            const pEndMin=agendaTimeToMinutes(p.end);
            if(index>0&&pStartMin>prevEndMin){
                const pauseMin=pStartMin-prevEndMin;
                const pauseTop=((prevEndMin-startMin)/totalMin)*100;
                const pauseHeight=(pauseMin/totalMin)*100;
                html+=`<div class="timeline-pause-label" style="top:${Number(pauseTop)}%;height:${Number(pauseHeight)}%;" title="Pause de ${Number(pauseMin)} min">☕ Pause ${Number(pauseMin)}m<br><small>${escapeHtml(prevEndStr)}–${escapeHtml(p.start)}</small></div>`;
            }
            const pTop=((pStartMin-startMin)/totalMin)*100;
            const pHeight=((pEndMin-pStartMin)/totalMin)*100;
            html+=`<div class="timeline-period-badge" style="top:${Number(pTop)}%;height:${Number(pHeight)}%;"><strong>${escapeHtml(p.label)}</strong><small>${escapeHtml(`${escapeHtml(p.start)}–${escapeHtml(p.end)}`)}</small></div>`;
            prevEndMin=pEndMin;
            prevEndStr=p.end;
        });
        html+=`</div>`;

        html+=`<div class="timeline-grid-col js-timeline-column" data-iso="${escapeHtml(selectedDateISO)}" data-day-index="${Number(dayIdx)}">`;

        prevEndMin=-1;
        agendaPeriodConfig.forEach((p,index)=>{
            const pStartMin=agendaTimeToMinutes(p.start);
            const pEndMin=agendaTimeToMinutes(p.end);
            if(index>0&&pStartMin>prevEndMin){
                const pauseMin=pStartMin-prevEndMin;
                const pauseTop=((prevEndMin-startMin)/totalMin)*100;
                const pauseHeight=(pauseMin/totalMin)*100;
                html+=`<div class="day-timeline-pause" style="position:absolute;left:0;right:0;top:${Number(pauseTop)}%;height:${Number(pauseHeight)}%;">☕ Pause · ${Number(pauseMin)} min (${escapeHtml(prevEndStr)} → ${escapeHtml(p.start)})</div>`;
            }
            const pTop=((pStartMin-startMin)/totalMin)*100;
            const pHeight=((pEndMin-pStartMin)/totalMin)*100;
            const eventsHere=events.filter(ev=>ev._sMin<pEndMin&&ev._eMin>pStartMin);
            if(!eventsHere.length){
                html+=`<div class="day-free-slot js-open-slot" style="position:absolute;left:0;right:0;top:${Number(pTop)}%;height:${Number(pHeight)}%;" data-drop-iso="${escapeHtml(selectedDateISO)}" data-drop-period="${escapeHtml(p.label)}" data-iso="${escapeHtml(selectedDateISO)}" data-period="${escapeHtml(p.label)}" data-day-index="${Number(dayIdx)}" data-force-create="true"><span>Créneau libre (${escapeHtml(`${escapeHtml(p.start)}–${escapeHtml(p.end)}`)})</span><button type="button" class="btn-secondary focus-ring js-open-slot" data-direct-open="true" data-force-create="true" data-iso="${escapeHtml(selectedDateISO)}" data-period="${escapeHtml(p.label)}" data-day-index="${Number(dayIdx)}" style="padding:6px 10px;font-size:.74rem;border-radius:8px;cursor:pointer;">＋ Programmer</button></div>`;
            }else{
                html+=`<div class="day-overlap-add js-open-slot" style="position:absolute;left:0;right:0;top:${Number(pTop)}%;height:${Number(pHeight)}%;" data-drop-iso="${escapeHtml(selectedDateISO)}" data-drop-period="${escapeHtml(p.label)}" data-iso="${escapeHtml(selectedDateISO)}" data-period="${escapeHtml(p.label)}" data-day-index="${Number(dayIdx)}" data-force-create="true"><button type="button" class="btn-secondary focus-ring js-open-slot" data-direct-open="true" data-force-create="true" data-iso="${escapeHtml(selectedDateISO)}" data-period="${escapeHtml(p.label)}" data-day-index="${Number(dayIdx)}">＋ Ajouter sur ce créneau</button></div>`;
            }
            prevEndMin=pEndMin;
            prevEndStr=p.end;
        });

        events.forEach(ev=>{
            const state=getEventState(ev,dayIdx,selectedDateISO,db);
            const span=ev.endIndex-ev.startIndex+1;
            const range=ev.startPeriod===ev.endPeriod?ev.startPeriod:`${ev.startPeriod} → ${ev.endPeriod}`;
            const cls=getEventClass(ev,state);
            const meta=getEventMeta(ev)||'Mission Pôle Territorial';
            const sTimeStr=agendaMinutesToTime(ev._sMin);
            const eTimeStr=agendaMinutesToTime(ev._eMin);
            const exactTimeRange=`${sTimeStr}–${eTimeStr}`;
            const recLabel=ev.recurrence==='unique'?'Unique':(ev.recurrence==='daily'?'Quotidien':(ev.recurrence==='monthly'?'Mensuel':(ev.recurrence==='yearly'?'Annuel':'Hebdomadaire')));

            const topPct=Math.max(0,((ev._sMin-startMin)/totalMin)*100);
            const heightPct=Math.max(3.8,((Math.max(ev._sMin+10,ev._eMin)-ev._sMin)/totalMin)*100);

            html+=`<div class="day-event-layer" style="position:absolute;top:${Number(topPct)}%;height:${Number(heightPct)}%;left:calc(${Number(ev.lane*(100/laneCount))}% + 3px);width:calc(${Number(100/laneCount)}% - 6px);"><button type="button" draggable="true" class="day-event-card ${escapeHtml(cls)} js-day-event" data-iso="${escapeHtml(selectedDateISO)}" data-start-period="${escapeHtml(ev.startPeriod)}" data-end-period="${escapeHtml(ev.endPeriod)}" data-day-index="${Number(dayIdx)}" data-event-id="${escapeHtml(ev.eventId)}" data-start-time="${escapeHtml(sTimeStr)}" data-end-time="${escapeHtml(eTimeStr)}" aria-label="${escapeHtml(`${getEventLabel(ev)} · ${range} · ${state.label}`)}"><span class="status-badge agenda-status-${escapeHtml(state.key)}">${escapeHtml(state.label)}</span><span class="slot-info-main"><span class="slot-title">${escapeHtml(getEventLabel(ev))}</span><span class="slot-meta">${escapeHtml(meta)} · ${escapeHtml(recLabel)}</span></span><span class="week-event-range">${escapeHtml(range)} · ${escapeHtml(exactTimeRange)}</span><div class="event-resize-handle" data-event-id="${escapeHtml(ev.eventId)}" data-iso="${escapeHtml(selectedDateISO)}" title="Glisser pour redimensionner"></div></button>${ev.type==='ELEVE'&&state.key!=='realized'&&state.key!=='cancelled'?`<button type="button" class="day-event-encode btn-primary focus-ring js-quick-form" data-iso="${escapeHtml(selectedDateISO)}" data-start-period="${escapeHtml(ev.startPeriod)}" data-eleve="${escapeHtml(ev.eleve)}" data-matiere="${escapeHtml(ev.matiere||'')}" style="padding:5px 8px;font-size:.68rem;border-radius:7px;cursor:pointer;">Encoder</button>`:''}</div>`;
        });

        html+=`</div></div>`;
        dayView.innerHTML=html;
        dayView.classList.add('day-timeline-grid');
        initDragAndDropHandlers(dayView);
        initTimelineSelection(dayView);
    }

    function periodIndex(period){return periods.indexOf(period);}
    function syncSessionPeriodRange(){const start=document.getElementById('f-periode-start'),end=document.getElementById('f-periode-end');if(!start||!end)return;const si=periodIndex(start.value),ei=periodIndex(end.value);if(si<0)return;if(ei<si)end.value=start.value;[...end.options].forEach((o,i)=>o.disabled=i<si);}
    function getSlotKey(dayIdx,period){return `${dayIdx}_${period}`;}
    function getDayIndexFromISO(iso){const d=parseISODate(iso),dow=d.getDay();return dow===0?6:dow-1;}

    function getEncodedEventId(event,iso,db){return getEncodedForEvent(getDayIndexFromISO(iso),iso,event,db);}

    function renderWeekView(){
        const monday=getMonday(parseISODate(selectedDateISO)),weekDates=[];
        for(let i=0;i<5;i++)weekDates.push(new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+i));
        const startStr=weekDates[0].toLocaleDateString('fr-FR',{day:'numeric',month:'short'}),endStr=weekDates[4].toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
        document.getElementById('agenda-date-label').innerText=`Semaine du ${startStr} au ${endStr}`;
        const weekView=document.getElementById('agenda-view-week'),db=getDB(),prev=getPrevisionnel();

        const allWeekEvents=[];
        const dayEventsMap=weekDates.map(d=>{
            const iso=formatISO(d);
            const evs=getEventsForDate(iso,prev);
            evs.forEach(e=>allWeekEvents.push(e));
            return {d,iso,events:evs};
        });

        const {startMin,endMin,totalMin}=getTimelineRange(allWeekEvents);
        const timelineHeight=Math.max(680,Math.round(totalMin*1.3));

        let html=`<div class="week-timeline-header"><div class="agenda-header-week">Période</div>`;
        weekDates.forEach((d,idx)=>{
            const iso=formatISO(d),dateStr=d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
            html+=`<div class="agenda-header-week ${iso===selectedDateISO?'today-column':''} js-week-day" data-iso="${escapeHtml(iso)}">${days[idx]}<br><span style="font-weight:600;font-size:.78rem;color:var(--primary);">${dateStr}</span></div>`;
        });
        html+=`</div>`;

        html+=`<div class="week-timeline-body" style="height:${timelineHeight}px;">`;

        html+=`<div class="timeline-time-col">`;
        let prevEndMin=-1;
        let prevEndStr='';
        agendaPeriodConfig.forEach((p,index)=>{
            const pStartMin=agendaTimeToMinutes(p.start);
            const pEndMin=agendaTimeToMinutes(p.end);
            if(index>0&&pStartMin>prevEndMin){
                const pauseMin=pStartMin-prevEndMin;
                const pauseTop=((prevEndMin-startMin)/totalMin)*100;
                const pauseHeight=(pauseMin/totalMin)*100;
                html+=`<div class="timeline-pause-label" style="top:${pauseTop}%;height:${pauseHeight}%;">☕ ${pauseMin}m</div>`;
            }
            const pTop=((pStartMin-startMin)/totalMin)*100;
            const pHeight=((pEndMin-pStartMin)/totalMin)*100;
            html+=`<div class="period-col-week timeline-period-badge" style="top:${pTop}%;height:${pHeight}%;"><strong>${escapeHtml(p.label)}</strong><small>${escapeHtml(`${p.start}–${p.end}`)}</small></div>`;
            prevEndMin=pEndMin;
            prevEndStr=p.end;
        });
        html+=`</div>`;

        dayEventsMap.forEach(({d,iso,events},dayIdx)=>{
            const laneCount=computeEventTimelineLanes(events);

            html+=`<div class="week-timeline-day-col js-timeline-column" data-iso="${escapeHtml(iso)}" data-day-index="${dayIdx}">`;

            prevEndMin=-1;
            agendaPeriodConfig.forEach((p,i)=>{
                const pStartMin=agendaTimeToMinutes(p.start);
                const pEndMin=agendaTimeToMinutes(p.end);
                if(i>0&&pStartMin>prevEndMin){
                    const pauseMin=pStartMin-prevEndMin;
                    const pauseTop=((prevEndMin-startMin)/totalMin)*100;
                    const pauseHeight=(pauseMin/totalMin)*100;
                    html+=`<div class="day-timeline-pause" style="position:absolute;left:0;right:0;top:${pauseTop}%;height:${pauseHeight}%;">☕ Pause</div>`;
                }
                const pTop=((pStartMin-startMin)/totalMin)*100;
                const pHeight=((pEndMin-pStartMin)/totalMin)*100;
                const eventsHere=events.filter(ev=>ev._sMin<pEndMin&&ev._eMin>pStartMin);
                html+=`<div class="slot-cell-week week-event-cell js-week-slot ${eventsHere.length?'week-slot-occupied':''}" data-force-create="true" style="position:absolute;left:0;right:0;top:${pTop}%;height:${pHeight}%;" data-iso="${escapeHtml(iso)}" data-period="${escapeHtml(p.label)}" data-day-index="${dayIdx}"><div class="week-slot-free">＋ ${eventsHere.length?'Ajouter':'Programmer'}</div></div>`;
                prevEndMin=pEndMin;
            });

            events.forEach(ev=>{
                const state=getEventState(ev,dayIdx,iso,db);
                const cls=getEventClass(ev,state);
                const meta=getEventMeta(ev);
                const sTimeStr=agendaMinutesToTime(ev._sMin);
                const eTimeStr=agendaMinutesToTime(ev._eMin);
                const timeText=`${sTimeStr}–${eTimeStr}`;
                const topPct=Math.max(0,((ev._sMin-startMin)/totalMin)*100);
                const heightPct=Math.max(3.8,((Math.max(ev._sMin+10,ev._eMin)-ev._sMin)/totalMin)*100);

                html+=`<div class="slot-cell-week week-event-cell week-event-overlay" style="position:absolute;top:${topPct}%;height:${heightPct}%;left:calc(${ev.lane*(100/laneCount)}% + 2px);width:calc(${100/laneCount}% - 4px);">
                    <div draggable="true" class="week-event ${cls} js-week-event" data-iso="${escapeHtml(iso)}" data-start-period="${escapeHtml(ev.startPeriod)}" data-end-period="${escapeHtml(ev.endPeriod)}" data-day-index="${dayIdx}" data-event-id="${escapeHtml(ev.eventId)}" data-start-time="${escapeHtml(sTimeStr)}" data-end-time="${escapeHtml(eTimeStr)}">
                        <div class="week-event-title">${escapeHtml(state.key==='realized'?'✓ ':'')}${escapeHtml(getEventLabel(ev))}</div>
                        ${meta?`<div class="week-event-meta">${escapeHtml(meta)}</div>`:''}
                        <div class="week-event-range">${escapeHtml(ev.startPeriod)}${ev.endPeriod!==ev.startPeriod?' → '+escapeHtml(ev.endPeriod):''} · ${escapeHtml(state.label)} · ${escapeHtml(timeText)}</div>
                        <div class="event-resize-handle" data-event-id="${escapeHtml(ev.eventId)}" data-iso="${escapeHtml(iso)}" title="Glisser pour redimensionner"></div>
                    </div>
                </div>`;
            });

            html+=`</div>`;
        });

        html+=`</div>`;
        weekView.innerHTML=html;
        initDragAndDropHandlers(weekView);
        initTimelineSelection(weekView);
    }

    function initTimelineSelection(container){
        if(!container)return;
        container.querySelectorAll('.js-timeline-column').forEach(col=>{
            col.addEventListener('dblclick',e=>{
                if(e.target.closest('.day-event-card, .week-event, .event-resize-handle, button, .day-event-encode'))return;
                const slotEl=e.target.closest('.js-week-slot, .js-open-slot');
                const iso=col.dataset.iso||selectedDateISO;
                const dayIdx=Number(col.dataset.dayIndex??getDayIndexFromISO(iso));
                if(slotEl && slotEl.dataset.period){
                    document.querySelectorAll('.is-slot-armed').forEach(el=>el.classList.remove('is-slot-armed'));
                    openSlotModal(slotEl.dataset.iso||iso,slotEl.dataset.period,Number(slotEl.dataset.dayIndex??dayIdx),null,true);
                    return;
                }
                const rect=col.getBoundingClientRect();
                const events=getEventsForDate(iso,getPrevisionnel());
                const {startMin,endMin,totalMin}=getTimelineRange(events);
                const clickMin=Math.round(((e.clientY-rect.top)/rect.height*totalMin+startMin)/10)*10;
                const sTime=agendaMinutesToTime(clickMin);
                const eTime=agendaMinutesToTime(Math.min(endMin,clickMin+50));
                const deduced=agendaPeriodsFromTimes(sTime,eTime);
                openSlotModal(iso,deduced.startPeriod,dayIdx,null,true);
                const tStart=document.getElementById('modal-slot-time-start');
                const tEnd=document.getElementById('modal-slot-time-end');
                if(tStart)tStart.value=sTime;
                if(tEnd)tEnd.value=eTime;
            });

            col.addEventListener('pointerdown',e=>{
                if(e.target.closest('.day-event-card, .week-event, .event-resize-handle, button, .day-event-encode'))return;
                const isTouch=e.pointerType==='touch'||e.pointerType==='pen';
                const iso=col.dataset.iso||selectedDateISO;
                const dayIdx=Number(col.dataset.dayIndex??getDayIndexFromISO(iso));
                const rect=col.getBoundingClientRect();
                const events=getEventsForDate(iso,getPrevisionnel());
                const {startMin,endMin,totalMin}=getTimelineRange(events);

                const startX=e.clientX;
                const startY=e.clientY;
                const clickMin=Math.round(((e.clientY-rect.top)/rect.height*totalMin+startMin)/10)*10;

                if(isTouch){
                    let moved=false;
                    let longPressTriggered=false;
                    const slotEl=e.target.closest('.js-week-slot, .js-open-slot');
                    const lpTimer=setTimeout(()=>{
                        if(moved)return;
                        longPressTriggered=true;
                        window._jrSuppressNextClick=Date.now();
                        document.querySelectorAll('.is-slot-armed').forEach(el=>el.classList.remove('is-slot-armed'));
                        if(navigator.vibrate)try{navigator.vibrate(18);}catch(_){/* vibration tactile optionnelle non supportée */}
                        if(slotEl && slotEl.dataset.period){
                            openSlotModal(slotEl.dataset.iso||iso,slotEl.dataset.period,Number(slotEl.dataset.dayIndex??dayIdx),null,true);
                        }else{
                            const sTime=agendaMinutesToTime(clickMin);
                            const eTime=agendaMinutesToTime(Math.min(endMin,clickMin+50));
                            const deduced=agendaPeriodsFromTimes(sTime,eTime);
                            openSlotModal(iso,deduced.startPeriod,dayIdx,null,true);
                            const tStart=document.getElementById('modal-slot-time-start');
                            const tEnd=document.getElementById('modal-slot-time-end');
                            if(tStart)tStart.value=sTime;
                            if(tEnd)tEnd.value=eTime;
                        }
                    },450);

                    const onTouchMove=moveEv=>{
                        if(Math.abs(moveEv.clientY-startY)>8||Math.abs(moveEv.clientX-startX)>8){
                            moved=true;
                            window._jrLastTouchScrollTime=Date.now();
                            clearTimeout(lpTimer);
                        }
                    };
                    const onTouchEnd=()=>{
                        clearTimeout(lpTimer);
                        window.removeEventListener('pointermove',onTouchMove);
                        window.removeEventListener('pointerup',onTouchEnd);
                        window.removeEventListener('pointercancel',onTouchEnd);
                        if(moved||longPressTriggered){
                            window._jrSuppressNextClick=Date.now();
                        }
                    };
                    window.addEventListener('pointermove',onTouchMove,{passive:true});
                    window.addEventListener('pointerup',onTouchEnd,{passive:true});
                    window.addEventListener('pointercancel',onTouchEnd,{passive:true});
                    return;
                }

                if(e.button!==0)return;
                let isDragging=false;
                let selectionBox=null;

                const onPointerMove=moveEv=>{
                    const dy=moveEv.clientY-startY;
                    if(Math.abs(dy)>12){
                        if(!isDragging){
                            isDragging=true;
                            document.querySelectorAll('.is-slot-armed').forEach(el=>el.classList.remove('is-slot-armed'));
                            selectionBox=document.createElement('div');
                            selectionBox.className='timeline-selection-box';
                            col.appendChild(selectionBox);
                        }
                        const currentMin=Math.round(((moveEv.clientY-rect.top)/rect.height*totalMin+startMin)/10)*10;
                        const sMin=Math.max(startMin,Math.min(clickMin,currentMin));
                        const eMin=Math.min(endMin,Math.max(clickMin,currentMin));
                        const topPct=((sMin-startMin)/totalMin)*100;
                        const heightPct=Math.max(3.5,((eMin-sMin)/totalMin)*100);
                        selectionBox.style.top=`${topPct}%`;
                        selectionBox.style.height=`${heightPct}%`;
                        selectionBox.textContent=`⏱️ ${agendaMinutesToTime(sMin)} → ${agendaMinutesToTime(eMin)}`;
                    }
                };

                const onPointerUp=upEv=>{
                    window.removeEventListener('pointermove',onPointerMove);
                    window.removeEventListener('pointerup',onPointerUp);
                    if(selectionBox)selectionBox.remove();
                    if(isDragging){
                        window._jrSuppressNextClick=Date.now();
                        const currentMin=Math.round(((upEv.clientY-rect.top)/rect.height*totalMin+startMin)/10)*10;
                        const sMin=Math.max(startMin,Math.min(clickMin,currentMin));
                        const eMin=Math.min(endMin,Math.max(sMin+10,Math.max(clickMin,currentMin)));
                        const sTime=agendaMinutesToTime(sMin);
                        const eTime=agendaMinutesToTime(eMin);
                        const deduced=agendaPeriodsFromTimes(sTime,eTime);
                        openSlotModal(iso,deduced.startPeriod,dayIdx,null,true);
                        const tStart=document.getElementById('modal-slot-time-start');
                        const tEnd=document.getElementById('modal-slot-time-end');
                        if(tStart)tStart.value=sTime;
                        if(tEnd)tEnd.value=eTime;
                        const pStart=document.getElementById('modal-slot-period-start');
                        const pEnd=document.getElementById('modal-slot-period-end');
                        if(pStart)pStart.value=deduced.startPeriod;
                        if(pEnd)pEnd.value=deduced.endPeriod;
                    }
                };
                window.addEventListener('pointermove',onPointerMove);
                window.addEventListener('pointerup',onPointerUp);
            });
        });
    }

    function initDragAndDropHandlers(container){
        if(!container)return;
        container.querySelectorAll('[draggable="true"]').forEach(el=>{
            el.addEventListener('dragstart',e=>{
                e.stopPropagation();
                const eventId=el.dataset.eventId,iso=el.dataset.iso,startPeriod=el.dataset.startPeriod,endPeriod=el.dataset.endPeriod||startPeriod,dayIndex=el.dataset.dayIndex,startTime=el.dataset.startTime||'',endTime=el.dataset.endTime||'';
                e.dataTransfer.setData('application/json',JSON.stringify({eventId,iso,startPeriod,endPeriod,dayIndex,startTime,endTime}));
                e.dataTransfer.effectAllowed='move';
                el.classList.add('is-dragging');
            });
            el.addEventListener('dragend',()=>el.classList.remove('is-dragging'));
        });
        container.querySelectorAll('.js-timeline-column, .day-free-slot, .day-overlap-add, .js-week-slot, [data-drop-period]').forEach(zone=>{
            zone.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';zone.classList.add('timeline-drop-target');});
            zone.addEventListener('dragleave',()=>zone.classList.remove('timeline-drop-target'));
            zone.addEventListener('drop',async e=>{
                e.preventDefault();zone.classList.remove('timeline-drop-target');
                let data;try{data=JSON.parse(e.dataTransfer.getData('application/json'));}catch(_){/* charge utile glisser-déposer non exploitable (donnée déposée non-JSON) */return;}
                if(!data||!data.eventId)return;
                const col=zone.closest('.js-timeline-column')||zone;
                const targetIso=col.dataset.iso||zone.dataset.iso||zone.dataset.dropIso||selectedDateISO;
                const targetDayIndex=Number(col.dataset.dayIndex??zone.dataset.dayIndex??getDayIndexFromISO(targetIso));
                const rect=col.getBoundingClientRect();
                const {startMin,totalMin}=getTimelineRange();
                const offsetY=e.clientY-rect.top;
                const dropMin=Math.round((offsetY/rect.height*totalMin+startMin)/10)*10;
                await handleEventMove(data,targetIso,dropMin,targetDayIndex);
            });
        });
        container.querySelectorAll('.event-resize-handle').forEach(handle=>{
            handle.addEventListener('pointerdown',e=>{
                e.stopPropagation();e.preventDefault();
                initResizeInteraction(handle,handle.dataset.eventId,handle.dataset.iso,e);
            });
        });
    }

    function previousDayISO(iso){
        const d=parseISODate(iso);
        d.setDate(d.getDate()-1);
        return formatISO(d);
    }

    function addSeriesExceptionDate(prev,seriesId,isoDate){
        if(!prev||!seriesId||!isoDate)return;
        prev.__exceptions=prev.__exceptions||{};
        const dates=new Set(prev.__exceptions[seriesId]||[]);
        dates.add(isoDate);
        prev.__exceptions[seriesId]=[...dates];
    }

    function closeRecurringMasterBeforeDate(prev,eventId,seriesId,splitDateIso){
        if(!prev||!Array.isArray(prev.__events))return null;
        const master=prev.__events.find(ev=>ev.eventId===eventId||ev.seriesId===seriesId);
        if(master){
            master.recurrenceRange={...(master.recurrenceRange||{type:'endDate',startDate:master.date||'2026-08-24'}),type:'endDate',endDate:previousDayISO(splitDateIso)};
            master.updatedAt=new Date().toISOString();
        }
        return master||null;
    }

    async function handleEventMove(data,targetIso,targetStartMin,targetDayIndex){
        const prev=getPrevisionnel(),event=findAgendaEventForOccurrence(data.iso,data.eventId,prev);
        if(!event)return;

        const curSMin=data.startTime?agendaTimeToMinutes(data.startTime):agendaTimeToMinutes(agendaPeriodByLabel(event.startPeriod)?.start||'08:00');
        const curEMin=data.endTime?agendaTimeToMinutes(data.endTime):agendaTimeToMinutes(agendaPeriodByLabel(event.endPeriod)?.end||'08:50');
        const durationMin=Math.max(10,curEMin-curSMin);

        const {startMin,endMin}=getTimelineRange();
        const newStartMin=Math.max(startMin,Math.min(endMin-durationMin,targetStartMin));
        const newEndMin=newStartMin+durationMin;
        const newStartTime=agendaMinutesToTime(newStartMin);
        const newEndTime=agendaMinutesToTime(newEndMin);
        const newStartDateTime=`${targetIso}T${newStartTime}:00`;
        const newEndDateTime=`${targetIso}T${newEndTime}:00`;
        const deduced=agendaPeriodsFromTimes(newStartTime,newEndTime);

        if(event.recurrence!=='unique'&&event.seriesId){
            showSeriesOrOccurrenceModal({
                onOccurrence:async()=>{
                    const working=JSON.parse(JSON.stringify(getPrevisionnel()));
                    addSeriesExceptionDate(working,event.seriesId,data.iso);
                    const occurrenceEvent={...event,eventId:journalierUuid('evt'),seriesId:event.seriesId,recurrence:'unique',date:targetIso,dayIndex:targetDayIndex,startPeriod:deduced.startPeriod,endPeriod:deduced.endPeriod,startDateTime:newStartDateTime,endDateTime:newEndDateTime,updatedAt:new Date().toISOString()};
                    working.__events.push(normalizeAgendaEvent(occurrenceEvent,JournalierSecurity.accountKey));
                    await savePrevisionnel(working);renderAgenda();showAppToast('Occurrence déplacée.','success');
                },
                onFollowing:async()=>{
                    const working=JSON.parse(JSON.stringify(getPrevisionnel()));
                    closeRecurringMasterBeforeDate(working,event.eventId,event.seriesId,data.iso);
                    const newId=journalierUuid('evt');
                    const followingSeries={...event,eventId:newId,seriesId:newId,dayIndex:targetDayIndex,startPeriod:deduced.startPeriod,endPeriod:deduced.endPeriod,startDateTime:newStartDateTime,endDateTime:newEndDateTime,recurrenceRange:{...(event.recurrenceRange||{type:'noEnd'}),startDate:targetIso},updatedAt:new Date().toISOString()};
                    if(followingSeries.recurrencePattern?.daysOfWeek&&event.recurrence==='weekly')followingSeries.recurrencePattern={...followingSeries.recurrencePattern,daysOfWeek:[targetDayIndex]};
                    working.__events.push(normalizeAgendaEvent(followingSeries,JournalierSecurity.accountKey));
                    await savePrevisionnel(working);renderAgenda();showAppToast('Cette occurrence et les suivantes ont été déplacées.','success');
                },
                onSeries:async()=>{
                    const working=JSON.parse(JSON.stringify(getPrevisionnel()));
                    const master=working.__events.find(ev=>ev.eventId===event.eventId||ev.seriesId===event.seriesId);
                    if(master){
                        master.dayIndex=targetDayIndex;master.startPeriod=deduced.startPeriod;master.endPeriod=deduced.endPeriod;master.startDateTime=`${master.date||targetIso}T${newStartTime}:00`;master.endDateTime=`${master.date||targetIso}T${newEndTime}:00`;
                        if(master.recurrencePattern?.daysOfWeek&&master.recurrence==='weekly'&&master.recurrencePattern.daysOfWeek.length===1)master.recurrencePattern.daysOfWeek=[targetDayIndex];
                        master.updatedAt=new Date().toISOString();
                    }
                    await savePrevisionnel(working);renderAgenda();showAppToast('Série récurrente déplacée.','success');
                }
            });
            return;
        }
        const working=JSON.parse(JSON.stringify(prev)),stored=working.__events.find(ev=>ev.eventId===event.eventId);
        if(stored){
            stored.date=targetIso;stored.dayIndex=targetDayIndex;stored.startPeriod=deduced.startPeriod;stored.endPeriod=deduced.endPeriod;stored.startDateTime=newStartDateTime;stored.endDateTime=newEndDateTime;stored.updatedAt=new Date().toISOString();
            await savePrevisionnel(working);renderAgenda();showAppToast('Événement déplacé.','success');
        }
    }

    function initResizeInteraction(handle,eventId,iso,startEvt){
        const prev=getPrevisionnel(),event=findAgendaEventForOccurrence(iso,eventId,prev);if(!event)return;
        const column=handle.closest('.js-timeline-column')||handle.closest('.day-timeline-layout')||handle.closest('.week-timeline-body');
        const rect=column?.getBoundingClientRect()||{top:0,height:680};
        const {startMin,endMin,totalMin}=getTimelineRange();
        const {sMin:curSMin,eMin:curEMin}=getEventStartEndMinutes(event);
        let previewEndMin=curEMin;
        const card=handle.closest('.day-event-card, .week-event');
        if(card)card.classList.add('is-resizing');

        const onPointerMove=e=>{
            const offsetY=e.clientY-rect.top;
            const pointerMin=Math.round((offsetY/rect.height*totalMin+startMin)/10)*10;
            previewEndMin=Math.max(curSMin+10,Math.min(endMin,pointerMin));
            const rangeSpan=card?.querySelector('.week-event-range');
            if(rangeSpan)rangeSpan.textContent=`⏱️ ${agendaMinutesToTime(curSMin)} → ${agendaMinutesToTime(previewEndMin)}`;
        };
        const onPointerUp=async()=>{
            window.removeEventListener('pointermove',onPointerMove);window.removeEventListener('pointerup',onPointerUp);
            window._jrSuppressNextClick=Date.now();
            if(card)card.classList.remove('is-resizing');
            if(previewEndMin===curEMin)return;

            const newEndTime=agendaMinutesToTime(previewEndMin);
            const newEndDateTime=`${iso}T${newEndTime}:00`;
            const sTime=agendaMinutesToTime(curSMin);
            const deduced=agendaPeriodsFromTimes(sTime,newEndTime);

            if(event.recurrence!=='unique'&&event.seriesId){
                showSeriesOrOccurrenceModal({
                    onOccurrence:async()=>{
                        const working=JSON.parse(JSON.stringify(getPrevisionnel()));
                        addSeriesExceptionDate(working,event.seriesId,iso);
                        const occurrenceEvent={...event,eventId:journalierUuid('evt'),seriesId:event.seriesId,recurrence:'unique',date:iso,endPeriod:deduced.endPeriod,endDateTime:newEndDateTime,updatedAt:new Date().toISOString()};
                        working.__events.push(normalizeAgendaEvent(occurrenceEvent,JournalierSecurity.accountKey));
                        await savePrevisionnel(working);renderAgenda();showAppToast('Durée de l’occurrence modifiée.','success');
                    },
                    onFollowing:async()=>{
                        const working=JSON.parse(JSON.stringify(getPrevisionnel()));
                        closeRecurringMasterBeforeDate(working,event.eventId,event.seriesId,iso);
                        const newId=journalierUuid('evt');
                        const followingSeries={...event,eventId:newId,seriesId:newId,endPeriod:deduced.endPeriod,endDateTime:newEndDateTime,recurrenceRange:{...(event.recurrenceRange||{type:'noEnd'}),startDate:iso},updatedAt:new Date().toISOString()};
                        working.__events.push(normalizeAgendaEvent(followingSeries,JournalierSecurity.accountKey));
                        await savePrevisionnel(working);renderAgenda();showAppToast('Durée de cette occurrence et des suivantes modifiée.','success');
                    },
                    onSeries:async()=>{
                        const working=JSON.parse(JSON.stringify(getPrevisionnel()));
                        const master=working.__events.find(ev=>ev.eventId===event.eventId||ev.seriesId===event.seriesId);
                        if(master){master.endPeriod=deduced.endPeriod;master.endDateTime=`${master.date||iso}T${newEndTime}:00`;master.updatedAt=new Date().toISOString();}
                        await savePrevisionnel(working);renderAgenda();showAppToast('Durée de la série modifiée.','success');
                    }
                });
                return;
            }
            const working=JSON.parse(JSON.stringify(prev)),stored=working.__events.find(ev=>ev.eventId===event.eventId);
            if(stored){stored.endPeriod=deduced.endPeriod;stored.endDateTime=newEndDateTime;stored.updatedAt=new Date().toISOString();await savePrevisionnel(working);renderAgenda();showAppToast('Durée modifiée.','success');}
        };
        window.addEventListener('pointermove',onPointerMove);window.addEventListener('pointerup',onPointerUp);
    }

    function showSeriesOrOccurrenceModal({onOccurrence,onFollowing,onSeries}){
        const modal=document.getElementById('eventSeriesChoiceModal');if(!modal){onOccurrence();return;}
        modal.classList.remove('hidden');
        const btnOcc=document.getElementById('btn-edit-occurrence-only'),btnFol=document.getElementById('btn-edit-following'),btnSer=document.getElementById('btn-edit-entire-series'),btnCancel=document.getElementById('btn-cancel-series-choice');
        const cleanup=()=>{modal.classList.add('hidden');if(btnOcc)btnOcc.onclick=null;if(btnFol)btnFol.onclick=null;if(btnSer)btnSer.onclick=null;if(btnCancel)btnCancel.onclick=null;};
        if(btnOcc)btnOcc.onclick=()=>{cleanup();onOccurrence();};
        if(btnFol){
            btnFol.style.display=typeof onFollowing==='function'?'':'none';
            btnFol.onclick=()=>{cleanup();if(typeof onFollowing==='function')onFollowing();else onSeries?.();};
        }
        if(btnSer)btnSer.onclick=()=>{cleanup();onSeries();};
        if(btnCancel)btnCancel.onclick=()=>{cleanup();};
    }

    function renderMonthView(){
        const dt=parseISODate(selectedDateISO),year=dt.getFullYear(),month=dt.getMonth();
        const monthName=dt.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});document.getElementById('agenda-date-label').innerText=monthName.charAt(0).toUpperCase()+monthName.slice(1);
        const monthView=document.getElementById('agenda-view-month'),db=getDB(),prev=getPrevisionnel(),first=new Date(year,month,1),last=new Date(year,month+1,0);let start=first.getDay();start=start===0?6:start-1;let html='';['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].forEach(w=>html+=`<div class="month-day-header">${w}</div>`);
        const prevLast=new Date(year,month,0).getDate();for(let i=start-1;i>=0;i--)html+=`<div class="month-date-cell other-month"><div class="month-day-number">${prevLast-i}</div></div>`;
        for(let day=1;day<=last.getDate();day++){
            const cell=new Date(year,month,day),iso=formatISO(cell),dayIdx=getDayIndexFromISO(iso),events=getEventsForDate(iso,prev),pills=[];const max=4;
            events.slice(0,max).forEach(ev=>{const state=getEventState(ev,dayIdx,iso,db),cls=ev.type==='FORMATION'?'event-formation':ev.type==='COLLAB'?'event-collab':ev.type==='ADMIN'?'event-admin':'';const label=ev.type==='ELEVE'?[getEventLabel(ev),getEventMeta(ev)].filter(Boolean).join(' · '):getEventLabel(ev);const range=ev.startPeriod===ev.endPeriod?ev.startPeriod:`${ev.startPeriod}–${ev.endPeriod}`;pills.push(`<div class="month-indicator-pill month-planned-pill ${cls} agenda-status-${state.key}" title="${escapeHtml(label)} — ${escapeHtml(range)}"><span class="month-planned-dot"></span><span class="month-planned-label">${escapeHtml(state.key==='realized'?'✓ ':'')}${escapeHtml(label)}</span><span class="month-period-range">${escapeHtml(range)}</span></div>`);});
            const more=Math.max(0,events.length-max);if(more)pills.push(`<div class="month-more-pill">+ ${more} autre${more>1?'s':''}</div>`);
            html+=`<div class="month-date-cell ${iso===selectedDateISO?'today':''} js-month-day" data-iso="${escapeHtml(iso)}"><div class="month-day-number">${day}</div><div class="month-indicators">${pills.join('')}</div></div>`;
        }
        monthView.innerHTML=html;
    }

    function jumpToDayView(isoDate){selectedDateISO=isoDate;switchAgendaView('day');}
    function populatePeriodSelectors(startValue,endValue){const start=document.getElementById('modal-slot-period-start'),end=document.getElementById('modal-slot-period-end');if(!start||!end)return;const options=periods.map(p=>`<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');start.innerHTML=options;end.innerHTML=options;start.value=startValue||periods[0];end.value=endValue||startValue||periods[0];syncAgendaEndPeriod();start.onchange=syncAgendaStartPeriod;end.onchange=syncAgendaEndPeriod;}
    function syncAgendaEndPeriod(){
        const start=document.getElementById('modal-slot-period-start'),end=document.getElementById('modal-slot-period-end');
        if(!start||!end)return;
        const si=periodIndex(start.value),ei=periodIndex(end.value);
        if(ei<si)end.value=start.value;
        [...end.options].forEach((o,i)=>o.disabled=i<si);
        const p1=agendaPeriodByLabel(start.value), p2=agendaPeriodByLabel(end.value);
        const tStart=document.getElementById('modal-slot-time-start'), tEnd=document.getElementById('modal-slot-time-end');
        if(p1&&tStart&&!tStart.matches(':focus'))tStart.value=p1.start;
        if(p2&&tEnd&&!tEnd.matches(':focus'))tEnd.value=p2.end;
    }
    function syncAgendaStartPeriod(){syncAgendaEndPeriod();}
    window.JournalierAgendaConfig={
        refreshSessionPeriodSelectors(){
            const start=document.getElementById('f-periode-start')?.value||periods[0];
            const end=document.getElementById('f-periode-end')?.value||start;
            populatePeriodSelectors(start,end);
            syncSessionPeriodRange();
        },
        getPeriods(){
            return agendaPeriodConfig.map(p=>({...p}));
        },
        applyConfig(config){
            return applyAgendaPeriodConfig(config);
        },
        getOccurrenceDateTime(event,iso){
            if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||'')))return null;
            const sTime=event?.startDateTime?event.startDateTime.split('T')[1]?.slice(0,5):null;
            const eTime=event?.endDateTime?event.endDateTime.split('T')[1]?.slice(0,5):null;
            const start=agendaPeriodByLabel(event?.startPeriod),end=agendaPeriodByLabel(event?.endPeriod||event?.startPeriod);
            const finalStart=sTime||start?.start;
            const finalEnd=eTime||end?.end;
            if(!finalStart||!finalEnd)return null;
            return {timezone:event?.timezone||'Europe/Brussels',start:`${iso}T${finalStart}:00`,end:`${iso}T${finalEnd}:00`};
        }
    };
    function toggleDuplicateFields(){const enabled=Boolean(document.getElementById('modal-duplicate-enabled')?.checked);document.getElementById('modal-duplicate-fields')?.classList.toggle('hidden',!enabled);}
    function updateRecurrenceNote(){
        updateRecurrenceAdvancedUI();
    }
    function updateRecurrenceAdvancedUI(event=null){
        const mode=document.getElementById('modal-slot-recurrence')?.value||'weekly';
        const advBox=document.getElementById('modal-recurrence-advanced');
        const note=document.getElementById('modal-slot-recurrence-note');
        const intervalInput=document.getElementById('modal-slot-recurrence-interval');
        const unitLabel=document.getElementById('modal-slot-recurrence-unit');
        const daysBox=document.getElementById('modal-slot-recurrence-days-box');
        const monthlyBox=document.getElementById('modal-slot-recurrence-monthly-box');
        const monthlyModeSelect=document.getElementById('modal-slot-recurrence-monthly-mode');
        const endTypeSelect=document.getElementById('modal-slot-recurrence-end-type');
        const endDateInput=document.getElementById('modal-slot-recurrence-end-date');
        const countInput=document.getElementById('modal-slot-recurrence-count');

        if(mode==='unique'){
            if(advBox)advBox.style.display='none';
            if(note)note.textContent='Cette activité aura lieu uniquement à la date choisie.';
            return;
        }

        if(advBox)advBox.style.display='grid';
        const pattern=event?.recurrencePattern;
        if(intervalInput)intervalInput.value=pattern?.interval||1;
        if(monthlyBox)monthlyBox.style.display=mode==='monthly'?'block':'none';

        if(mode==='daily'){
            if(unitLabel)unitLabel.textContent='jour(s)';
            if(daysBox)daysBox.style.display='none';
            if(note)note.textContent='Cette activité sera répétée selon l’intervalle quotidien choisi.';
        }else if(mode==='weekly'){
            if(unitLabel)unitLabel.textContent='semaine(s)';
            if(daysBox)daysBox.style.display='block';
            if(note)note.textContent='Cette activité sera répétée chaque semaine le(s) même(s) jour(s).';
            const curDate=document.getElementById('modal-slot-date-visible')?.value||selectedDateISO;
            const fallbackDay=getDayIndexFromISO(curDate);
            const graphDays=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
            const checkedDays=Array.isArray(pattern?.daysOfWeek)&&pattern.daysOfWeek.length>0?pattern.daysOfWeek.map(d=>{
                if(typeof d==='string'){const idx=graphDays.indexOf(d.toLowerCase());return idx>=0?idx:Number(d);}
                return Number(d);
            }):[fallbackDay];
            document.querySelectorAll('.recurrence-day-checkbox').forEach(cb=>{
                cb.checked=checkedDays.includes(Number(cb.value));
            });
        }else if(mode==='monthly'){
            if(unitLabel)unitLabel.textContent='mois';
            if(daysBox)daysBox.style.display='none';
            if(monthlyModeSelect){
                monthlyModeSelect.value=pattern?.index&&['first','second','third','fourth','last'].includes(pattern.index)?pattern.index:'dayOfMonth';
            }
            if(note)note.textContent='Cette activité sera répétée chaque mois selon la règle choisie.';
        }else if(mode==='yearly'){
            if(unitLabel)unitLabel.textContent='an(s)';
            if(daysBox)daysBox.style.display='none';
            if(note)note.textContent='Cette activité sera répétée chaque année à la même date.';
        }

        const range=event?.recurrenceRange;
        const endType=(range?.type==='numbered'||range?.type==='count')?'count':(range?.type==='endDate'?'endDate':'noEnd');
        if(endTypeSelect){
            endTypeSelect.value=endType;
            endTypeSelect.onchange=()=>{
                const cur=endTypeSelect.value;
                if(endDateInput)endDateInput.style.display=cur==='endDate'?'inline-block':'none';
                if(countInput)countInput.style.display=cur==='count'?'inline-block':'none';
            };
        }
        if(endDateInput){
            endDateInput.style.display=endType==='endDate'?'inline-block':'none';
            endDateInput.value=range?.endDate||'';
        }
        if(countInput){
            countInput.style.display=endType==='count'?'inline-block':'none';
            countInput.value=range?.numberOfOccurrences||10;
        }
    }

    function onModalSlotTimesChange(){
        const tStart=document.getElementById('modal-slot-time-start')?.value;
        const tEnd=document.getElementById('modal-slot-time-end')?.value;
        if(tStart&&tEnd&&agendaTimeToMinutes(tEnd)>agendaTimeToMinutes(tStart)){
            const deduced=agendaPeriodsFromTimes(tStart,tEnd);
            const pStart=document.getElementById('modal-slot-period-start');
            const pEnd=document.getElementById('modal-slot-period-end');
            if(pStart&&periods.includes(deduced.startPeriod))pStart.value=deduced.startPeriod;
            if(pEnd&&periods.includes(deduced.endPeriod))pEnd.value=deduced.endPeriod;
        }
    }

    function buildAgendaActivityFromModal(type,startPeriod,endPeriod){
        const base={type,startPeriod,endPeriod,eventStatus:'proposed',realized:false};
        if(type==='ELEVE'){
            const name=document.getElementById('modal-slot-eleve').value;const student=getStudents().find(s=>String(s.nom)===String(name));
            return {...base,eleve:name,eleveId:student?.studentId||'',matiere:document.getElementById('modal-slot-matiere').value,local:document.getElementById('modal-slot-local').value};
        }
        if(type==='LIBRE')return {...base,title:'Créneau libre',detail:''};
        return {...base,title:document.getElementById('modal-slot-admin-title').value||'Activité Pôle',detail:document.getElementById('modal-slot-admin-detail').value||''};
    }

    function removeRecurringSeries(prev,seriesId){prev.__events=(prev.__events||[]).filter(ev=>ev.seriesId!==seriesId&&ev.eventId!==seriesId);if(prev.__exceptions)delete prev.__exceptions[seriesId];}
    function removeUniqueEvent(prev,eventId){prev.__events=(prev.__events||[]).filter(ev=>!(ev.eventId===eventId&&ev.recurrence==='unique'));}

    function openSlotModal(dateIso,period,dayIdx,eventId=null,forceCreate=false){
        const prev=getPrevisionnel(),event=!forceCreate&&(eventId?findAgendaEventForOccurrence(dateIso,eventId,prev):getEventForDatePeriod(dateIso,period,prev)),edit=Boolean(event);
        agendaModalState={mode:edit?'edit':'create',eventId:event?.eventId||null,recurrence:event?.recurrence||null,occurrenceDate:dateIso,sourceEvent:event||null};
        document.getElementById('modal-slot-date').value=dateIso;document.getElementById('modal-slot-date-visible').value=dateIso;document.getElementById('modal-slot-period').value=period;document.getElementById('modal-slot-event-id').value=event?.eventId||'';document.getElementById('modal-slot-edit-mode').value=edit?'edit':'create';document.getElementById('modal-slot-title').innerText=edit?'Modifier l’activité':`Programmer une activité${dayIdx>=0&&dayIdx<=4?' · '+days[dayIdx]:''}`;
        document.getElementById('modal-slot-admin-title').value='';document.getElementById('modal-slot-admin-detail').value='';document.getElementById('modal-slot-local').value='';document.getElementById('modal-duplicate-enabled').checked=false;document.getElementById('modal-duplicate-date').value='';toggleDuplicateFields();
        const startP=event?.startPeriod||period||periods[0];
        const endP=event?.endPeriod||startP;
        populatePeriodSelectors(startP,endP);

        const p1=agendaPeriodByLabel(startP)||agendaPeriodConfig[0];
        const p2=agendaPeriodByLabel(endP)||p1;
        const sTime=event?.startDateTime?event.startDateTime.split('T')[1]?.slice(0,5):p1.start;
        const eTime=event?.endDateTime?event.endDateTime.split('T')[1]?.slice(0,5):p2.end;
        const tStart=document.getElementById('modal-slot-time-start');
        const tEnd=document.getElementById('modal-slot-time-end');
        if(tStart){tStart.value=sTime;tStart.oninput=onModalSlotTimesChange;}
        if(tEnd){tEnd.value=eTime;tEnd.oninput=onModalSlotTimesChange;}

        const recSelect=document.getElementById('modal-slot-recurrence');
        if(recSelect)recSelect.value=event?.recurrence||(edit?'unique':'weekly');
        updateRecurrenceAdvancedUI(event);

        document.getElementById('modal-slot-type').value=event?.type||'ELEVE';
        if(event?.type==='ELEVE'){document.getElementById('modal-slot-eleve').value=event.eleve||'';refreshSlotSubjects(event.matiere||'');document.getElementById('modal-slot-local').value=event.local||'';}
        else{document.getElementById('modal-slot-eleve').value='';refreshSlotSubjects('');document.getElementById('modal-slot-admin-title').value=event?.title||'';document.getElementById('modal-slot-admin-detail').value=event?.detail||'';}
        toggleModalSlotFields();document.getElementById('slotModal').classList.remove('hidden');
    }

    function openDuplicateEventModal(isoDate,period,dayIdx,eventId){const event=findAgendaEventForOccurrence(isoDate,eventId,getPrevisionnel());if(!event)return;openSlotModal(isoDate,period,dayIdx,eventId);agendaModalState={mode:'duplicate',eventId:event.eventId,recurrence:event.recurrence,occurrenceDate:isoDate,sourceEvent:event};document.getElementById('modal-slot-edit-mode').value='duplicate';document.getElementById('modal-slot-title').innerText='Dupliquer l’activité';document.getElementById('modal-slot-recurrence').value='unique';updateRecurrenceNote();document.getElementById('modal-duplicate-enabled').checked=true;toggleDuplicateFields();}
    function refreshSlotSubjects(preferred){
        const select=document.getElementById('modal-slot-matiere');if(!select)return;
        const studentName=document.getElementById('modal-slot-eleve')?.value||'';
        const student=getStudents().find(s=>String(s.nom)===String(studentName));
        const own=(window.JournalierStudents?.normalizeSubjectList?.(student?.matieres)||[]);
        const std=(window.JournalierStudents?.SUBJECT_OPTIONS||['Mathématiques','Français']).filter(x=>!own.includes(x));
        const wanted=String(preferred||select.value||'');
        const opt=(v)=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`;
        let html='';
        if(own.length)html+=`<optgroup label="Matières du dossier de l’élève">${own.map(opt).join('')}</optgroup>`;
        if(wanted&&!own.includes(wanted)&&!std.includes(wanted))html+=opt(wanted);
        html+=`<optgroup label="${own.length?'Autres matières':'Matières'}">${std.map(opt).join('')}</optgroup>`;
        select.innerHTML=html;
        select.value=wanted&&[...select.options].some(o=>o.value===wanted)?wanted:(own[0]||select.options[0]?.value||'');
    }
    if(typeof document!=='undefined'&&typeof document.addEventListener==='function')document.addEventListener('change',event=>{if(event.target?.id==='modal-slot-eleve')refreshSlotSubjects('');});
    function toggleModalSlotFields(){const type=document.getElementById('modal-slot-type').value;document.getElementById('modal-fields-eleve').classList.toggle('hidden',type!=='ELEVE');document.getElementById('modal-fields-autre').classList.toggle('hidden',type==='ELEVE'||type==='LIBRE');}
    function closeSlotModal(){closeAllChoiceMenus();document.getElementById('slotModal').classList.add('hidden');}

    function rangesOverlap(a,b){return a.startIndex<=b.endIndex&&b.startIndex<=a.endIndex;}
    function getOverlappingEvents(iso,dateStart,dateEnd,prev,excludeId=null){return getEventsForDate(iso,prev).filter(ev=>ev.eventId!==excludeId&&rangesOverlap({startIndex:dateStart,endIndex:dateEnd},ev));}

    async function saveSlotModification(){
        const sourceDateIso=document.getElementById('modal-slot-date-visible').value||document.getElementById('modal-slot-date').value,type=document.getElementById('modal-slot-type').value,recurrence=document.getElementById('modal-slot-recurrence').value||'weekly',startPeriod=document.getElementById('modal-slot-period-start').value,endPeriod=document.getElementById('modal-slot-period-end').value,mode=agendaModalState.mode||document.getElementById('modal-slot-edit-mode').value||'create',duplicateTargetDate=document.getElementById('modal-duplicate-date').value,dateIso=mode==='duplicate'?duplicateTargetDate:sourceDateIso,dayIdx=getDayIndexFromISO(dateIso),startIdx=periodIndex(startPeriod),endIdx=periodIndex(endPeriod);
        if(!dateIso){showAppToast('Choisissez une date.','error');return;}
        if(recurrence==='weekly'&&(dayIdx<0||dayIdx>4)){showAppToast('Une planification récurrente hebdomadaire doit être placée du lundi au vendredi.','error');return;}
        if(startIdx<0||endIdx<startIdx){showAppToast('La période de fin doit être identique ou postérieure à la période de début.','error');return;}
        if(type==='ELEVE'&&!document.getElementById('modal-slot-eleve').value){showAppToast('Sélectionnez un élève.','error');return;}

        const p1=agendaPeriodByLabel(startPeriod)||agendaPeriodConfig[0];
        const p2=agendaPeriodByLabel(endPeriod)||p1;
        const rawStartTime=document.getElementById('modal-slot-time-start')?.value||p1.start;
        const rawEndTime=document.getElementById('modal-slot-time-end')?.value||p2.end;
        if(agendaTimeToMinutes(rawEndTime)<=agendaTimeToMinutes(rawStartTime)){
            showAppToast('L’heure de fin doit être postérieure à l’heure de début.','error');
            return;
        }

        const startDateTime=`${dateIso}T${rawStartTime}:00`;
        const endDateTime=`${dateIso}T${rawEndTime}:00`;
        const deduced=agendaPeriodsFromTimes(rawStartTime,rawEndTime);

        let recurrencePattern=null;
        let recurrenceRange=null;
        if(recurrence!=='unique'){
            const interval=Math.max(1,Number(document.getElementById('modal-slot-recurrence-interval')?.value)||1);
            const checkedDays=Array.from(document.querySelectorAll('.recurrence-day-checkbox:checked')).map(cb=>Number(cb.value));
            const daysOfWeek=checkedDays.length>0?checkedDays:[dayIdx];
            const monthlyMode=document.getElementById('modal-slot-recurrence-monthly-mode')?.value||'dayOfMonth';
            const isRelativeMonthly=recurrence==='monthly'&&['first','second','third','fourth','last'].includes(monthlyMode);
            recurrencePattern={
                type:isRelativeMonthly?'relativeMonthly':recurrence,
                interval,
                daysOfWeek:recurrence==='weekly'?daysOfWeek:(isRelativeMonthly?[dayIdx]:undefined),
                dayOfMonth:(recurrence==='monthly'&&!isRelativeMonthly)||recurrence==='yearly'?parseISODate(dateIso).getDate():undefined,
                index:isRelativeMonthly?monthlyMode:undefined,
                month:recurrence==='yearly'?parseISODate(dateIso).getMonth()+1:undefined
            };

            const endType=document.getElementById('modal-slot-recurrence-end-type')?.value||'noEnd';
            const endDate=document.getElementById('modal-slot-recurrence-end-date')?.value||null;
            const count=Number(document.getElementById('modal-slot-recurrence-count')?.value)||10;
            recurrenceRange={
                type:endType,
                startDate:dateIso,
                endDate:endType==='endDate'?endDate:null,
                numberOfOccurrences:endType==='count'?count:null
            };
        }

        const prev=getPrevisionnel();
        const working=JSON.parse(JSON.stringify(prev));
        const editingEventId=mode==='edit'?agendaModalState.eventId:null;
        const editingRecurrence=mode==='edit'?agendaModalState.recurrence:null;

        const draft=buildAgendaActivityFromModal(type,deduced.startPeriod,deduced.endPeriod);
        draft.eventId=editingEventId||journalierUuid('evt');
        draft.ownerId=JournalierSecurity.accountKey;
        draft.dataVersion=JOURNALIER_ARCHITECTURE_VERSION;
        draft.recurrence=recurrence;
        draft.dayIndex=dayIdx;
        draft.date=recurrence==='unique'?dateIso:'';
        draft.seriesId=recurrence!=='unique'?(agendaModalState.sourceEvent?.seriesId||draft.eventId):null;
        draft.startDateTime=startDateTime;
        draft.endDateTime=endDateTime;
        draft.timezone='Europe/Brussels';
        if(recurrencePattern)draft.recurrencePattern=recurrencePattern;
        if(recurrenceRange)draft.recurrenceRange=recurrenceRange;

        if(mode==='edit'&&editingRecurrence!=='unique'&&agendaModalState.sourceEvent?.seriesId){
            showSeriesOrOccurrenceModal({
                onOccurrence:async()=>{
                    const w=JSON.parse(JSON.stringify(getPrevisionnel()));
                    const seriesKey=agendaModalState.sourceEvent.seriesId;
                    addSeriesExceptionDate(w,seriesKey,agendaModalState.occurrenceDate||dateIso);

                    draft.eventId=journalierUuid('evt');
                    draft.seriesId=seriesKey;
                    draft.recurrence='unique';
                    draft.date=dateIso;
                    w.__events.push(normalizeAgendaEvent(draft,JournalierSecurity.accountKey));
                    await savePrevisionnel(w);
                    closeSlotModal();
                    renderAgenda();
                    showAppToast('Occurrence enregistrée.','success');
                },
                onFollowing:async()=>{
                    const w=JSON.parse(JSON.stringify(getPrevisionnel()));
                    const seriesKey=agendaModalState.sourceEvent.seriesId||editingEventId;
                    const splitDate=agendaModalState.occurrenceDate||dateIso;
                    closeRecurringMasterBeforeDate(w,editingEventId,seriesKey,splitDate);
                    const newSeriesId=journalierUuid('evt');
                    draft.eventId=newSeriesId;
                    draft.seriesId=newSeriesId;
                    if(draft.recurrenceRange)draft.recurrenceRange.startDate=dateIso;
                    w.__events.push(normalizeAgendaEvent(draft,JournalierSecurity.accountKey));
                    await savePrevisionnel(w);
                    closeSlotModal();
                    renderAgenda();
                    showAppToast('Cette occurrence et les suivantes ont été mises à jour.','success');
                },
                onSeries:async()=>{
                    const w=JSON.parse(JSON.stringify(getPrevisionnel()));
                    removeRecurringSeries(w,agendaModalState.sourceEvent.seriesId||editingEventId);
                    w.__events.push(normalizeAgendaEvent(draft,JournalierSecurity.accountKey));
                    await savePrevisionnel(w);
                    closeSlotModal();
                    renderAgenda();
                    showAppToast('Série récurrente mise à jour.','success');
                }
            });
            return;
        }

        if(editingEventId){
            if(editingRecurrence==='unique')removeUniqueEvent(working,editingEventId);
            else removeRecurringSeries(working,editingEventId);
        }
        if(mode==='edit'&&agendaModalState.sourceEvent){
            draft.eventStatus=agendaModalState.sourceEvent.eventStatus;
            draft.realized=agendaModalState.sourceEvent.realized;
            draft.realizedAt=agendaModalState.sourceEvent.realizedAt;
            draft.outlook=agendaModalState.sourceEvent.outlook;
            draft.createdAt=agendaModalState.sourceEvent.createdAt;
        }
        working.__events=Array.isArray(working.__events)?working.__events:[];
        working.__events.push(normalizeAgendaEvent(draft,JournalierSecurity.accountKey));
        if(mode!=='duplicate'&&document.getElementById('modal-duplicate-enabled').checked&&duplicateTargetDate){
            const duplicate={...draft,eventId:journalierUuid('evt'),recurrence:'unique',seriesId:null,date:duplicateTargetDate,startDateTime:`${duplicateTargetDate}T${rawStartTime}:00`,endDateTime:`${duplicateTargetDate}T${rawEndTime}:00`,eventStatus:'proposed',realized:false,realizedAt:null,outlook:{calendarId:null,eventId:null,iCalUId:null,changeKey:null,webLink:null}};
            working.__events.push(normalizeAgendaEvent(duplicate,JournalierSecurity.accountKey));
        }
        try{await savePrevisionnel(working);closeSlotModal();renderAgenda();renderHome();showAppToast(mode==='duplicate'?'Activité dupliquée.':'Activité enregistrée.','success');}catch(error){console.error('Agenda — erreur lors de l’enregistrement',error);showAppToast(`Échec de l’enregistrement : ${error?.message||error}`,'error',5000);}
    }

    function openEventActionModal(isoDate,period,dayIdx,eventId){
        closeAllChoiceMenus();const prev=getPrevisionnel(),event=findAgendaEventForOccurrence(isoDate,eventId,prev)||getEventForDatePeriod(isoDate,period,prev);if(!event){openSlotModal(isoDate,period,dayIdx);return;}
        agendaModalState={...agendaModalState,eventId:event.eventId,recurrence:event.recurrence,occurrenceDate:isoDate,sourceEvent:event};
        document.getElementById('event-action-title').innerText=getEventLabel(event);
        const state=getEventState(event,dayIdx,isoDate,getDB()),summary=document.getElementById('event-action-summary');
        if(summary){summary.innerHTML=`<strong>${escapeHtml(getEventLabel(event))}</strong><br>${escapeHtml(getEventMeta(event)||'Mission Pôle Territorial')}<br><span style="color:var(--text-sub);">${escapeHtml(event.occurrenceDate||isoDate)} · ${escapeHtml(event.startPeriod)}${event.endPeriod!==event.startPeriod?' → '+escapeHtml(event.endPeriod):''} · ${escapeHtml(state.label)}</span>`;}
        const observe=document.getElementById('event-action-observe');observe.textContent=event.type==='ELEVE'?(state.key==='realized'?'✏️ Modifier la séance':'📝 Encoder la séance'):'🗒️ Détail de la mission';observe.style.display='';observe.onclick=()=>{closeEventActionModal();if(event.type==='ELEVE'){const encoded=getEncodedForEvent(dayIdx,isoDate,event,getDB());if(encoded)editHistorySession(encoded.id);else quickFormForSlot(isoDate,event.startPeriod,event.eleve,event.matiere);}else openSlotModal(isoDate,event.startPeriod,dayIdx,event.eventId);};
        const realize=document.getElementById('event-action-realize');if(realize){realize.style.display=event.type==='ELEVE'||state.key==='cancelled'?'none':'';realize.textContent=state.key==='realized'?'↩️ Marquer non réalisé':'✓ Marquer comme réalisé';realize.onclick=()=>toggleAgendaEventRealized(isoDate,event.eventId);}
        const cancel=document.getElementById('event-action-cancel');if(cancel){cancel.style.display=state.key==='cancelled'?'none':'';cancel.textContent=event.type==='ELEVE'?'⏸️ Annuler / Signaler une absence':'⏸️ Annuler l’événement';cancel.onclick=()=>{if(event.type==='ELEVE'){closeEventActionModal();openEventCancelModal(isoDate,event.startPeriod||period,dayIdx,event.eventId);}else{cancelAgendaEvent(event.eventId);}};}
        document.getElementById('event-action-edit').onclick=()=>{closeEventActionModal();openSlotModal(isoDate,event.startPeriod,dayIdx,event.eventId);};
        document.getElementById('event-action-extend').onclick=()=>{closeEventActionModal();openSlotModal(isoDate,event.startPeriod,dayIdx,event.eventId);};
        document.getElementById('event-action-duplicate').onclick=()=>{closeEventActionModal();openDuplicateEventModal(isoDate,event.startPeriod,dayIdx,event.eventId);};
        document.getElementById('event-action-delete').onclick=()=>openEventDeleteModal(event);
        document.getElementById('eventActionModal').classList.remove('hidden');
    }

    function closeEventActionModal(){closeAllChoiceMenus();document.getElementById('eventActionModal').classList.add('hidden');}

    async function toggleAgendaEventRealized(iso,eventId){
        const prev=getPrevisionnel(),stored=prev.__events.find(e=>e.eventId===eventId);if(!stored)return;
        if(stored.type==='ELEVE')return;
        const occDate=iso||agendaModalState.occurrenceDate||selectedDateISO;
        if(stored.recurrence!=='unique'&&stored.seriesId){
            closeEventActionModal();
            showSeriesOrOccurrenceModal({
                onOccurrence:async()=>{
                    const w=JSON.parse(JSON.stringify(getPrevisionnel()));
                    addSeriesExceptionDate(w,stored.seriesId,occDate);
                    const nextRealized=!stored.realized;
                    const occEvent={...stored,eventId:journalierUuid('evt'),seriesId:stored.seriesId,recurrence:'unique',date:occDate,realized:nextRealized,eventStatus:nextRealized?'realized':'proposed',realizedAt:nextRealized?new Date().toISOString():null,updatedAt:new Date().toISOString()};
                    w.__events.push(normalizeAgendaEvent(occEvent,JournalierSecurity.accountKey));
                    await savePrevisionnel(w);
                    renderAgenda();
                    showAppToast(nextRealized?'Occurrence marquée comme réalisée.':'Occurrence remise en état planifié.','success');
                },
                onSeries:async()=>{
                    const w=JSON.parse(JSON.stringify(getPrevisionnel()));
                    const master=w.__events.find(e=>e.eventId===eventId);
                    if(master){
                        master.realized=!master.realized;
                        master.eventStatus=master.realized?'realized':'proposed';
                        master.realizedAt=master.realized?new Date().toISOString():null;
                        master.updatedAt=new Date().toISOString();
                    }
                    await savePrevisionnel(w);
                    renderAgenda();
                    showAppToast(master?.realized?'Série marquée comme réalisée.':'Série remise en état planifié.','success');
                }
            });
            return;
        }
        stored.realized=!stored.realized;stored.eventStatus=stored.realized?'realized':'proposed';stored.realizedAt=stored.realized?new Date().toISOString():null;stored.updatedAt=new Date().toISOString();await savePrevisionnel(prev);closeEventActionModal();showAppToast(stored.realized?'Événement marqué comme réalisé.':'Événement remis en état planifié.','success');
    }
    async function cancelAgendaEvent(eventId){
        const prev=getPrevisionnel(),stored=prev.__events.find(e=>e.eventId===eventId);if(!stored)return;
        const occDate=agendaModalState.occurrenceDate||selectedDateISO;
        if(stored.recurrence!=='unique'&&stored.seriesId){
            closeEventActionModal();
            showSeriesOrOccurrenceModal({
                onOccurrence:async()=>{
                    const w=JSON.parse(JSON.stringify(getPrevisionnel()));
                    addSeriesExceptionDate(w,stored.seriesId,occDate);
                    const occCancelled={...stored,eventId:journalierUuid('evt'),seriesId:stored.seriesId,recurrence:'unique',date:occDate,eventStatus:'cancelled',realized:false,realizedAt:null,updatedAt:new Date().toISOString()};
                    w.__events.push(normalizeAgendaEvent(occCancelled,JournalierSecurity.accountKey));
                    await savePrevisionnel(w);
                    renderAgenda();
                    showAppToast('Occurrence annulée.','success');
                },
                onSeries:async()=>{
                    const w=JSON.parse(JSON.stringify(getPrevisionnel()));
                    const master=w.__events.find(e=>e.eventId===eventId);
                    if(master){master.eventStatus='cancelled';master.realized=false;master.realizedAt=null;master.updatedAt=new Date().toISOString();}
                    await savePrevisionnel(w);
                    renderAgenda();
                    showAppToast('Série annulée.','success');
                }
            });
            return;
        }
        stored.eventStatus='cancelled';stored.realized=false;stored.realizedAt=null;stored.updatedAt=new Date().toISOString();await savePrevisionnel(prev);closeEventActionModal();showAppToast('Événement annulé.','success');
    }

    async function applyAgendaCancelQualification(event,isoDate,reason,noteVal=''){
        if(!event)return;
        const prev=getPrevisionnel(),working=JSON.parse(JSON.stringify(prev));
        const stored=working.__events.find(e=>e.eventId===event.eventId||e.seriesId===event.seriesId);
        const isCoteach=reason==='absent_eleve_coteach';
        const nextStatus=isCoteach?'realized':'cancelled';
        if(stored){
            if(stored.recurrence!=='unique'&&stored.seriesId){
                addSeriesExceptionDate(working,stored.seriesId,isoDate);
                const occEntry={...stored,eventId:journalierUuid('evt'),seriesId:stored.seriesId,recurrence:'unique',date:isoDate,eventStatus:nextStatus,realized:isCoteach,realizedAt:isCoteach?new Date().toISOString():null,cancelReason:reason,cancelNote:noteVal,updatedAt:new Date().toISOString()};
                working.__events.push(normalizeAgendaEvent(occEntry,JournalierSecurity.accountKey));
            }else{
                stored.eventStatus=nextStatus;
                stored.realized=isCoteach;
                stored.realizedAt=isCoteach?new Date().toISOString():null;
                stored.cancelReason=reason;
                stored.cancelNote=noteVal;
                stored.updatedAt=new Date().toISOString();
            }
            await savePrevisionnel(working);
            renderAgenda();
        }
    }

    function recordQuickAbsenceSession(event,isoDate,presenceStatus,noteText=''){
        if(!event||event.type!=='ELEVE')return;
        const students=getStudents();
        const student=students.find(s=>(event.eleveId&&String(s.studentId)===String(event.eleveId))||String(s.nom)===String(event.eleve||''));
        const eleveName=student?.nom||event.eleve||'';
        if(!eleveName)return;
        const startP=event.startPeriod||periods[0];
        const endP=event.endPeriod||startP;
        const matiere=event.matiere||'Mathématiques';
        const labelObj=presenceStatus==='absent_prof'?'Professeur absent / Cours annulé':presenceStatus==='absent_agent'?'Agent du pôle absent':'Élève absent — Séance non tenue';
        const now=new Date().toISOString();
        const newEntry={
            id:Date.now()+Math.floor(Math.random()*1000),
            schemaVersion:JOURNALIER_ARCHITECTURE_VERSION,
            type:'SEANCE',
            identification:{eleve:eleveName,date:isoDate,periode:{start:startP,end:endP}},
            contexte:{
                matiere,
                niveau:student?.niveau||'S2',
                forme:student?.forme||'G',
                typeIntervention:[],
                presenceStatus,
                classNotes:noteText
            },
            objectif:{
                objectifLecon:noteText?`${labelObj} — ${noteText}`:labelObj,
                objectifProfessionnel:''
            },
            q2:{observations:[],precision:''},
            q3:{repereWBE:{signature:'',hit:'',kind:'',bridgeId:'',indicatorIds:[],source:''},indicateurs:[],precision:''},
            q4:{situation:'none',types:[],effets:{},precision:''},
            q5:{statut:'',precision:''},
            q6:{actions:[],modalite:'',objectif:'',collaborations:[],precision:noteText},
            metadata:{createdAt:now,updatedAt:now}
        };
        try{
            persistSessionEntry(newEntry);
            loadStudentHistory();
            updateStats();
        }catch(err){
            console.error('Impossible d’enregistrer la trace d’absence',err);
        }
    }

    function closeEventCancelModal(){
        document.getElementById('eventCancelModal')?.classList.add('hidden');
    }

    function openEventCancelModal(isoDate,period,dayIdx,eventId){
        const prev=getPrevisionnel(),event=findAgendaEventForOccurrence(isoDate,eventId,prev)||getEventForDatePeriod(isoDate,period,prev);
        if(!event)return;
        const modal=document.getElementById('eventCancelModal');
        if(!modal){
            cancelAgendaEvent(event.eventId);
            return;
        }
        const summary=document.getElementById('event-cancel-summary');
        const range=event.startPeriod===event.endPeriod?event.startPeriod:`${event.startPeriod} → ${event.endPeriod}`;
        if(summary){
            summary.innerHTML=`<strong>${escapeHtml(getEventLabel(event))}</strong><br>${escapeHtml(getEventMeta(event)||'Mission Pôle Territorial')}<br><span style="color:var(--text-sub);">📅 ${escapeHtml(isoDate)} · ${escapeHtml(range)}</span>`;
        }
        const noteInput=document.getElementById('event-cancel-note');
        if(noteInput)noteInput.value=event.cancelNote||'';

        const choicesBox=document.getElementById('event-cancel-choices');
        if(choicesBox){
            choicesBox.querySelectorAll('[data-cancel-reason]').forEach(btn=>{
                btn.onclick=async()=>{
                    const reason=btn.getAttribute('data-cancel-reason')||'cancelled_other';
                    const noteVal=String(document.getElementById('event-cancel-note')?.value||'').trim();
                    closeEventCancelModal();
                    await applyAgendaCancelQualification(event,isoDate,reason,noteVal);
                    if(reason==='absent_eleve_coteach'){
                        quickFormForSlot(isoDate,event.startPeriod||period,event.eleve||'',event.matiere||'');
                        const pEnd=document.getElementById('f-periode-end');
                        if(pEnd && event.endPeriod){pEnd.value=event.endPeriod;syncSessionPeriodRange();}
                        window.setSessionPresenceMode?.('absent_eleve_coteach');
                        const classNotesEl=document.getElementById('f-classNotes');
                        if(classNotesEl && noteVal){
                            classNotesEl.value=noteVal;
                            classNotesEl.dispatchEvent(new Event('input',{bubbles:true}));
                        }
                        showAppToast('🟣 Mode « Élève absent — Co-enseignement / Notes » activé. Notez le chapitre et les notes pour l’élève.','info',4500);
                    }else if(reason==='absent_eleve'){
                        recordQuickAbsenceSession(event,isoDate,'absent_eleve',noteVal);
                        showAppToast('🟠 Absence de l’élève enregistrée dans l’agenda et l’historique du dossier.','success',3600);
                    }else if(reason==='absent_prof'){
                        recordQuickAbsenceSession(event,isoDate,'absent_prof',noteVal);
                        showAppToast('🔵 Absence du professeur enregistrée (non imputée au taux de présence de l’élève).','success',3600);
                    }else if(reason==='absent_agent'){
                        recordQuickAbsenceSession(event,isoDate,'absent_agent',noteVal);
                        showAppToast('🟤 Votre absence est enregistrée dans le Journalier (non imputée à l’élève).','success',3600);
                    }else{
                        showAppToast('⚪ Créneau marqué comme annulé dans l’agenda.','info',2600);
                    }
                };
            });
        }
        const closeBtn=document.getElementById('event-cancel-close-btn');
        if(closeBtn)closeBtn.onclick=closeEventCancelModal;
        modal.classList.remove('hidden');
    }

    function openEventDeleteModal(event){
        agendaDeleteState={eventId:event.eventId,seriesId:event.seriesId||event.eventId,occurrenceDate:event.occurrenceDate,recurrence:event.recurrence};
        const summary=document.getElementById('event-delete-summary');
        if(summary)summary.innerHTML=`<strong>${escapeHtml(getEventLabel(event))}</strong><br>${escapeHtml(getEventMeta(event)||'Mission Pôle Territorial')}<br><span style="color:var(--text-sub);">${escapeHtml(event.occurrenceDate||selectedDateISO)} · ${escapeHtml(event.startPeriod)}${event.endPeriod!==event.startPeriod?' → '+escapeHtml(event.endPeriod):''}</span>`;
        const isRecurring=event.recurrence!=='unique';
        const seriesActions=document.getElementById('event-delete-series-actions');
        if(seriesActions)seriesActions.style.display=isRecurring?'flex':'none';
        const occurrence=document.getElementById('event-delete-occurrence');
        const series=document.getElementById('event-delete-series');
        if(occurrence)occurrence.textContent=isRecurring?'🗑️ Supprimer cette occurrence uniquement':'🗑️ Supprimer l’événement';
        if(series){series.textContent='🗑️ Supprimer la série';series.style.display=isRecurring?'':'none';}
        closeEventActionModal();
        document.getElementById('eventDeleteModal').classList.remove('hidden');
    }
    function closeEventDeleteModal(){
        document.getElementById('eventDeleteModal').classList.add('hidden');
        agendaDeleteState={eventId:null,seriesId:null,occurrenceDate:null,recurrence:null};
    }
    document.getElementById('event-delete-occurrence')?.addEventListener('click',deleteAgendaOccurrence);
    document.getElementById('event-delete-series')?.addEventListener('click',deleteAgendaSeries);
    async function deleteAgendaOccurrence(){
        const prev=getPrevisionnel();
        if(!agendaDeleteState.eventId)return;
        if(agendaDeleteState.recurrence!=='unique'){
            const seriesKey=agendaDeleteState.seriesId||agendaDeleteState.eventId;
            addSeriesExceptionDate(prev,seriesKey,agendaDeleteState.occurrenceDate);
        }else{
            removeUniqueEvent(prev,agendaDeleteState.eventId);
        }
        await savePrevisionnel(prev);
        closeEventDeleteModal();
        showAppToast('Événement supprimé.','success');
    }
    async function deleteAgendaSeries(){
        const prev=getPrevisionnel();
        if(!agendaDeleteState.eventId)return;
        removeRecurringSeries(prev,agendaDeleteState.seriesId||agendaDeleteState.eventId);
        if(agendaDeleteState.recurrence==='unique')removeUniqueEvent(prev,agendaDeleteState.eventId);
        await savePrevisionnel(prev);
        closeEventDeleteModal();
        showAppToast('Événement supprimé.','success');
    }

    function openAgendaPeriodConfigModal(){
        const body=document.getElementById('agenda-period-config-body');if(!body)return;
        const currentPrev=getPrevisionnel();
        if(currentPrev?.__config?.periods){
            applyAgendaPeriodConfig(currentPrev.__config.periods);
        }
        body.innerHTML=agendaPeriodConfig.map((p,i)=>`<div class="agenda-period-config-row"><div><strong>${escapeHtml(p.label)}</strong><span class="agenda-period-config-help">Période ${i+1} · les pauses sont les espaces entre deux périodes.</span></div><label>Début<input type="time" data-period-config-start="${i}" value="${escapeHtml(p.start)}"></label><label>Fin<input type="time" data-period-config-end="${i}" value="${escapeHtml(p.end)}"></label></div>`).join('');
        document.getElementById('agendaPeriodConfigModal').classList.remove('hidden');
    }
    function closeAgendaPeriodConfigModal(){document.getElementById('agendaPeriodConfigModal')?.classList.add('hidden');}
    async function saveAgendaPeriodConfig(){
        const next=agendaPeriodConfig.map((p,i)=>{
            let start=String(document.querySelector(`[data-period-config-start="${i}"]`)?.value||p.start).trim();
            let end=String(document.querySelector(`[data-period-config-end="${i}"]`)?.value||p.end).trim();
            if(/^\d:\d{2}$/.test(start))start='0'+start;
            if(/^\d:\d{2}$/.test(end))end='0'+end;
            return {...p,start,end};
        });
        for(let i=0;i<next.length;i++){
            if(agendaTimeToMinutes(next[i].start)<0||agendaTimeToMinutes(next[i].end)<0||agendaTimeToMinutes(next[i].start)>=agendaTimeToMinutes(next[i].end)){
                showAppToast(`Horaires invalides pour ${next[i].label}.`,'error');
                return;
            }
            if(i>0&&agendaTimeToMinutes(next[i].start)<agendaTimeToMinutes(next[i-1].end)){
                showAppToast(`La ${next[i].label} commence avant la fin de la période précédente. Une pause peut exister, mais les périodes ne peuvent pas se chevaucher.`,'error');
                return;
            }
        }
        applyAgendaPeriodConfig(next);
        const prev=getPrevisionnel();
        prev.__config={version:2,periods:next.map(p=>({...p}))};
        if(Array.isArray(prev.__events)){
            prev.__events.forEach(ev=>{
                const p1=agendaPeriodByLabel(ev.startPeriod)||next[0];
                const p2=agendaPeriodByLabel(ev.endPeriod)||p1;
                const date=ev.date||'2026-09-01';
                ev.startDateTime=`${date}T${p1.start}:00`;
                ev.endDateTime=`${date}T${p2.end}:00`;
                ev.timezone='Europe/Brussels';
            });
        }
        try{
            await savePrevisionnel(prev);
            populatePeriodSelectors(document.getElementById('modal-slot-period-start')?.value,document.getElementById('modal-slot-period-end')?.value);
            syncSessionPeriodRange();
            closeAgendaPeriodConfigModal();
            renderAgenda();
            showAppToast('Horaires des 8 périodes enregistrés.','success');
        }catch(err){
            console.error('Agenda — erreur sauvegarde périodes',err);
            showAppToast('Échec de l’enregistrement des périodes : '+(err?.message||err),'error');
        }
    }

    document.getElementById('agenda-period-config-open')?.addEventListener('click',openAgendaPeriodConfigModal);
    document.getElementById('agenda-period-config-save')?.addEventListener('click',saveAgendaPeriodConfig);
    document.getElementById('agenda-period-config-cancel')?.addEventListener('click',closeAgendaPeriodConfigModal);
    document.getElementById('agenda-period-config-reset')?.addEventListener('click',()=>{applyAgendaPeriodConfig(DEFAULT_AGENDA_PERIODS);openAgendaPeriodConfigModal();});


    // --- Exports du module JournalierAgenda ---
    const JournalierAgenda = {
        get DEFAULT_AGENDA_PERIODS() { return DEFAULT_AGENDA_PERIODS; },
        get days() { return days; },
        get periods() { return periods; },
        get agendaPeriodConfig() { return agendaPeriodConfig; },
        get agendaMode() { return agendaMode; },
        set agendaMode(v) { agendaMode = v; },
        get selectedDateISO() { return selectedDateISO; },
        set selectedDateISO(v) { selectedDateISO = v; },
        getInitialDateISO,
        parseISODate,
        formatISO,
        getMonday,
        normalizeAgendaConfig,
        applyAgendaPeriodConfig,
        agendaPeriodByLabel,
        agendaTimesFromPeriods,
        agendaPeriodsFromTimes,
        agendaTimeToMinutes,
        agendaMinutesToTime,
        agendaEventIndexes,
        normalizeAgendaEvent,
        legacyAgendaEvents,
        normalizeAgendaData,
        normalizePrevisionnel,
        getPrevisionnel,
        savePrevisionnel,
        getTodayInApp,
        eventOccursOnDate,
        getEventsForDate,
        getEventsForDatePeriod,
        findAgendaEventForOccurrence,
        getEventForDatePeriod,
        getEventLabel,
        getEventMeta,
        getEventState,
        getEventClass,
        getEncodedForEvent,
        renderHome,
        switchAgendaView,
        todayAgenda,
        navigateAgenda,
        pickerDateChanged,
        renderAgenda,
        getTimelineRange,
        getEventStartEndMinutes,
        computeEventTimelineLanes,
        renderDayView,
        periodIndex,
        syncSessionPeriodRange,
        getSlotKey,
        getDayIndexFromISO,
        getEncodedEventId,
        renderWeekView,
        initTimelineSelection,
        initDragAndDropHandlers,
        previousDayISO,
        addSeriesExceptionDate,
        closeRecurringMasterBeforeDate,
        handleEventMove,
        initResizeInteraction,
        showSeriesOrOccurrenceModal,
        renderMonthView,
        jumpToDayView,
        populatePeriodSelectors,
        syncAgendaEndPeriod,
        syncAgendaStartPeriod,
        toggleDuplicateFields,
        updateRecurrenceNote,
        updateRecurrenceAdvancedUI,
        onModalSlotTimesChange,
        buildAgendaActivityFromModal,
        removeRecurringSeries,
        removeUniqueEvent,
        openSlotModal,
        openDuplicateEventModal,
        toggleModalSlotFields,
        closeSlotModal,
        rangesOverlap,
        getOverlappingEvents,
        saveSlotModification,
        openEventActionModal,
        closeEventActionModal,
        toggleAgendaEventRealized,
        cancelAgendaEvent,
        applyAgendaCancelQualification,
        recordQuickAbsenceSession,
        closeEventCancelModal,
        openEventCancelModal,
        openEventDeleteModal,
        closeEventDeleteModal,
        deleteAgendaOccurrence,
        deleteAgendaSeries,
        openAgendaPeriodConfigModal,
        closeAgendaPeriodConfigModal,
        saveAgendaPeriodConfig
    };

    if (typeof window !== 'undefined') {
        window.JournalierAgenda = JournalierAgenda;
        window.days = days;
        window.DEFAULT_AGENDA_PERIODS = DEFAULT_AGENDA_PERIODS;
        window.agendaPeriodConfig = agendaPeriodConfig;
        window.periods = periods;
        window.getInitialDateISO = getInitialDateISO;
        window.parseISODate = parseISODate;
        window.formatISO = formatISO;
        window.getMonday = getMonday;
        window.normalizeAgendaConfig = normalizeAgendaConfig;
        window.applyAgendaPeriodConfig = applyAgendaPeriodConfig;
        window.agendaPeriodByLabel = agendaPeriodByLabel;
        window.agendaTimesFromPeriods = agendaTimesFromPeriods;
        window.agendaPeriodsFromTimes = agendaPeriodsFromTimes;
        window.agendaTimeToMinutes = agendaTimeToMinutes;
        window.agendaMinutesToTime = agendaMinutesToTime;
        window.agendaEventIndexes = agendaEventIndexes;
        window.normalizeAgendaEvent = normalizeAgendaEvent;
        window.legacyAgendaEvents = legacyAgendaEvents;
        window.normalizeAgendaData = normalizeAgendaData;
        window.normalizePrevisionnel = normalizePrevisionnel;
        window.getPrevisionnel = getPrevisionnel;
        window.savePrevisionnel = savePrevisionnel;
        window.getTodayInApp = getTodayInApp;
        window.eventOccursOnDate = eventOccursOnDate;
        window.getEventsForDate = getEventsForDate;
        window.getEventsForDatePeriod = getEventsForDatePeriod;
        window.findAgendaEventForOccurrence = findAgendaEventForOccurrence;
        window.getEventForDatePeriod = getEventForDatePeriod;
        window.getEventLabel = getEventLabel;
        window.getEventMeta = getEventMeta;
        window.getEventState = getEventState;
        window.getEventClass = getEventClass;
        window.getEncodedForEvent = getEncodedForEvent;
        window.renderHome = renderHome;
        window.switchAgendaView = switchAgendaView;
        window.todayAgenda = todayAgenda;
        window.navigateAgenda = navigateAgenda;
        window.pickerDateChanged = pickerDateChanged;
        window.renderAgenda = renderAgenda;
        window.getTimelineRange = getTimelineRange;
        window.getEventStartEndMinutes = getEventStartEndMinutes;
        window.computeEventTimelineLanes = computeEventTimelineLanes;
        window.renderDayView = renderDayView;
        window.periodIndex = periodIndex;
        window.syncSessionPeriodRange = syncSessionPeriodRange;
        window.getSlotKey = getSlotKey;
        window.getDayIndexFromISO = getDayIndexFromISO;
        window.getEncodedEventId = getEncodedEventId;
        window.renderWeekView = renderWeekView;
        window.initTimelineSelection = initTimelineSelection;
        window.initDragAndDropHandlers = initDragAndDropHandlers;
        window.previousDayISO = previousDayISO;
        window.addSeriesExceptionDate = addSeriesExceptionDate;
        window.closeRecurringMasterBeforeDate = closeRecurringMasterBeforeDate;
        window.handleEventMove = handleEventMove;
        window.initResizeInteraction = initResizeInteraction;
        window.showSeriesOrOccurrenceModal = showSeriesOrOccurrenceModal;
        window.renderMonthView = renderMonthView;
        window.jumpToDayView = jumpToDayView;
        window.populatePeriodSelectors = populatePeriodSelectors;
        window.syncAgendaEndPeriod = syncAgendaEndPeriod;
        window.syncAgendaStartPeriod = syncAgendaStartPeriod;
        window.toggleDuplicateFields = toggleDuplicateFields;
        window.updateRecurrenceNote = updateRecurrenceNote;
        window.updateRecurrenceAdvancedUI = updateRecurrenceAdvancedUI;
        window.onModalSlotTimesChange = onModalSlotTimesChange;
        window.buildAgendaActivityFromModal = buildAgendaActivityFromModal;
        window.removeRecurringSeries = removeRecurringSeries;
        window.removeUniqueEvent = removeUniqueEvent;
        window.openSlotModal = openSlotModal;
        window.openDuplicateEventModal = openDuplicateEventModal;
        window.toggleModalSlotFields = toggleModalSlotFields;
        window.closeSlotModal = closeSlotModal;
        window.rangesOverlap = rangesOverlap;
        window.getOverlappingEvents = getOverlappingEvents;
        window.saveSlotModification = saveSlotModification;
        window.openEventActionModal = openEventActionModal;
        window.closeEventActionModal = closeEventActionModal;
        window.toggleAgendaEventRealized = toggleAgendaEventRealized;
        window.cancelAgendaEvent = cancelAgendaEvent;
        window.applyAgendaCancelQualification = applyAgendaCancelQualification;
        window.recordQuickAbsenceSession = recordQuickAbsenceSession;
        window.closeEventCancelModal = closeEventCancelModal;
        window.openEventCancelModal = openEventCancelModal;
        window.openEventDeleteModal = openEventDeleteModal;
        window.closeEventDeleteModal = closeEventDeleteModal;
        window.deleteAgendaOccurrence = deleteAgendaOccurrence;
        window.deleteAgendaSeries = deleteAgendaSeries;
        window.openAgendaPeriodConfigModal = openAgendaPeriodConfigModal;
        window.closeAgendaPeriodConfigModal = closeAgendaPeriodConfigModal;
        window.saveAgendaPeriodConfig = saveAgendaPeriodConfig;

        try {
            Object.defineProperty(window, 'selectedDateISO', {
                get: function() { return selectedDateISO; },
                set: function(v) { selectedDateISO = v; },
                configurable: true
            });
            Object.defineProperty(window, 'agendaMode', {
                get: function() { return agendaMode; },
                set: function(v) { agendaMode = v; },
                configurable: true
            });
            Object.defineProperty(window, 'agendaPeriodConfig', {
                get: function() { return agendaPeriodConfig; },
                set: function(v) { agendaPeriodConfig = v; },
                configurable: true
            });
            Object.defineProperty(window, 'periods', {
                get: function() { return periods; },
                set: function(v) { periods = v; },
                configurable: true
            });
        } catch (_) {
            /* environnement d'exécution restreint sans window */
        }
    }

    if (typeof global !== 'undefined') {
        global.JournalierAgenda = JournalierAgenda;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.JournalierAgenda = JournalierAgenda;
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
