// Deep audit v2 - run with: mongosh gre_db deep_audit_v2.js
var issues = [];
function flag(qid, col, issue) { issues.push({qid:qid, col:col, issue:issue}); }

function deepAudit(colName) {
  db.getCollection(colName).find({is_active:{$ne:false}}).forEach(function(q) {
    var qid = q.question_id || String(q._id);
    var opts  = q.options || [];
    var ans   = q.correct_answers || [];
    var qt    = (q.question_type  || "").toUpperCase().trim();
    var fmt   = (q.answer_format  || "").toUpperCase().trim();
    var nOpts = opts.length;
    var nAns  = ans.length;
    var optLabels = opts.map(function(o){ return (o.label||"").trim(); });

    if (!q.question_type || !q.question_type.trim()) flag(qid, colName, "MISSING_QUESTION_TYPE");
    if (!q.answer_format  || !q.answer_format.trim())  flag(qid, colName, "MISSING_ANSWER_FORMAT");
    if (!q.question_text  || !q.question_text.trim())  flag(qid, colName, "MISSING_QUESTION_TEXT");

    if (colName === "awa_questions") return;

    var seenLabels = {};
    opts.forEach(function(o) {
      var lbl = (o.label||"").trim();
      var txt = (o.text ||"").trim();
      if (!/^[A-Z]$/.test(lbl))   flag(qid, colName, "BAD_LABEL: ["+lbl+"]");
      if (!txt || txt === "")      flag(qid, colName, "EMPTY_OPT: label="+lbl);
      if (seenLabels[lbl])         flag(qid, colName, "DUPLICATE_LABEL: "+lbl);
      seenLabels[lbl] = true;
      if (/^[A-I]$/.test(txt) && !/^[A-I]$/.test(lbl)) flag(qid, colName, "SWAPPED: label="+lbl+" text="+txt);
      if (txt.indexOf("[Option") >= 0 && txt.indexOf("to be filled") >= 0) flag(qid, colName, "PLACEHOLDER: "+lbl);
    });

    if (nAns === 0) flag(qid, colName, "MISSING_ANSWERS");
    ans.forEach(function(a) {
      var val  = (a.value  || "").trim();
      var afmt = (a.format || "").toUpperCase();
      if (!val) flag(qid, colName, "EMPTY_ANSWER_VALUE");
      if (afmt === "LABEL" && a.option_label && optLabels.indexOf(a.option_label) < 0)
        flag(qid, colName, "BAD_ANSWER_REF: "+a.option_label+" not in ["+optLabels.join(",")+"]");
    });

    if (qt === "QUANTITATIVE_COMPARISON") {
      if (nOpts !== 4) flag(qid, colName, "QC_OPT_COUNT: "+nOpts+" expected 4");
    }
    if (qt === "NUMERIC_ENTRY") {
      if (nOpts > 0) flag(qid, colName, "NE_HAS_OPTS: "+nOpts);
    }
    if (qt === "SENTENCE_EQUIVALENCE") {
      if (nOpts !== 6) flag(qid, colName, "SE_OPT_COUNT: "+nOpts+" expected 6");
      if (nAns < 2)   flag(qid, colName, "SE_ANSWER_COUNT: "+nAns+" expected 2");
    }
    if (qt === "TEXT_COMPLETION") {
      var validCounts = [3, 5, 6, 9];
      if (validCounts.indexOf(nOpts) < 0 && nOpts > 0)
        flag(qid, colName, "TC_OPT_COUNT: "+nOpts);
      if (nOpts === 9) {
        var lr9 = ans.filter(function(a){ return a.format==="LABEL" && a.option_label; });
        if (lr9.length < 2) flag(qid, colName, "TC3_FEW_LABEL_ANSWERS: "+lr9.length);
      }
    }
    if (qt === "MCQ") {
      if (nOpts < 2) flag(qid, colName, "MCQ_TOO_FEW_OPTS: "+nOpts);
    }
    if (qt === "MULTIPLE_CHOICE_MULTI") {
      if (nOpts < 3) flag(qid, colName, "MULTI_TOO_FEW_OPTS: "+nOpts);
      if (nAns < 2)  flag(qid, colName, "MULTI_TOO_FEW_ANSWERS: "+nAns);
    }
  });
}

deepAudit("verbal_questions");
deepAudit("quant_questions");
deepAudit("awa_questions");

print("=== DEEP AUDIT v2 ===");
print("Total issues: " + issues.length);
var byType = {};
issues.forEach(function(i) {
  var k = i.issue.split(":")[0].trim();
  if (!byType[k]) byType[k] = [];
  byType[k].push(i);
});
Object.keys(byType).sort().forEach(function(key) {
  var g = byType[key];
  print("[" + key + "] " + g.length + " questions:");
  g.slice(0,10).forEach(function(i){ print("  " + i.col + " | " + i.qid + " | " + i.issue); });
  if (g.length > 10) print("  ...and " + (g.length-10) + " more");
});
if (issues.length === 0) print("ALL CLEAR - Zero issues!");
