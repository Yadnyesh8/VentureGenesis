"""Generate a PDF explaining the board-of-directors debate in VENTUREGENESIS."""
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Preformatted, HRFlowable, Table, TableStyle
)

OUT = "/sessions/zealous-sleepy-noether/mnt/outputs/VENTUREGENESIS_Board_Debate_Explained.pdf"

styles = getSampleStyleSheet()
INK = colors.HexColor("#1a1a2e")
ACCENT = colors.HexColor("#3b3b8f")
MUTED = colors.HexColor("#555555")
CODEBG = colors.HexColor("#f4f4f8")

styles.add(ParagraphStyle("VGTitle", parent=styles["Title"], textColor=INK,
                          fontSize=24, leading=28, spaceAfter=4))
styles.add(ParagraphStyle("VGSub", parent=styles["Normal"], textColor=MUTED,
                          fontSize=11, leading=15, spaceAfter=2))
styles.add(ParagraphStyle("VGH2", parent=styles["Heading2"], textColor=ACCENT,
                          fontSize=15, leading=19, spaceBefore=16, spaceAfter=6))
styles.add(ParagraphStyle("VGH3", parent=styles["Heading3"], textColor=INK,
                          fontSize=12, leading=16, spaceBefore=10, spaceAfter=3))
styles.add(ParagraphStyle("VGBody", parent=styles["BodyText"], textColor=INK,
                          fontSize=10.5, leading=15.5, spaceAfter=8))
styles.add(ParagraphStyle("VGCode", parent=styles["Code"], fontSize=8.5,
                          leading=11, textColor=INK, backColor=CODEBG,
                          borderPadding=6, leftIndent=4, spaceAfter=8))

S = styles
story = []

def body(t): story.append(Paragraph(t, S["VGBody"]))
def h2(t): story.append(Paragraph(t, S["VGH2"]))
def h3(t): story.append(Paragraph(t, S["VGH3"]))
def gap(h=6): story.append(Spacer(1, h))

# Header
story.append(Paragraph("The Board of Directors Debate", S["VGTitle"]))
story.append(Paragraph("How the multi-agent debate works in VENTUREGENESIS", S["VGSub"]))
story.append(Paragraph("Code walkthrough &bull; debate_engine.py and agents/board.py", S["VGSub"]))
gap(6)
story.append(HRFlowable(width="100%", thickness=1, color=ACCENT))
gap(8)

h2("The two layers")
body("There are two distinct things named &ldquo;board&rdquo; in this codebase, and they nest together.")
body("The <b>debate engine</b> (<font face='Courier'>debate_engine.py</font>) is the actual multi-agent argument &mdash; six role-playing agents talking across three rounds. The <b>board agent</b> (<font face='Courier'>agents/board.py</font>) is the wrapper: it runs the whole analysis pipeline (ML models, intelligence agents, and the debate), then has a Chairperson synthesize one final decision. The debate is just one of the inputs the Chairperson reads.")

h2("The debate itself (debate_engine.py)")
body("Six fixed roles sit on the board: <b>Founder, Investor, Financial, Customer, Market, and Competitor</b>. They move through three rounds, and the structure of each round is defined entirely by prompts in <font face='Courier'>prompts.yaml</font>.")

h3("Round 1 &mdash; independent opinions")
body("Each agent receives the startup context and gives its own take in 2&ndash;3 sentences, with a stance of <i>bullish</i>, <i>neutral</i>, or <i>bearish</i> (the <font face='Courier'>debate_round_1</font> prompt). No agent has seen any other yet.")

h3("Round 2 &mdash; challenges")
body("Each agent is now fed the prior transcript and told to push back on, or build on, at least one other agent&rsquo;s position (<font face='Courier'>debate_round_2</font>).")

h3("Round 3 &mdash; consensus")
body("Agents see the debate so far and move toward agreement, each giving a <font face='Courier'>final_recommendation</font> (<font face='Courier'>debate_round_3</font>).")

body("The loop lives in <font face='Courier'>run_debate()</font>. For each round it builds the <font face='Courier'>prior</font> string from the last six messages, then calls every role in turn via <font face='Courier'>_agent_turn()</font>, which picks the right prompt for the round and calls the live LLM (<font face='Courier'>llm.complete</font>). Each agent&rsquo;s turn is wrapped in try/except &mdash; if one agent errors, the engine emits an <font face='Courier'>agent_skipped</font> event and the debate continues rather than aborting.")

h3("How consensus is decided")
body("It is <b>not</b> the LLM that declares a winner. After round 3, the code takes a plain majority vote on the stances from round-3 messages only, then picks whichever stance appears most often:")
story.append(Preformatted(
    'stances = [m["stance"] for m in transcript if m["round"] == 3]\n'
    'consensus = max(set(stances), key=stances.count) if stances else "neutral"',
    S["VGCode"]))

h2("Two ways it runs")
body("<font face='Courier'>run_debate()</font> is a generator that <b>yields events</b> (<font face='Courier'>start</font>, <font face='Courier'>round_start</font>, <font face='Courier'>message</font>, <font face='Courier'>round_end</font>, <font face='Courier'>consensus</font>). The <font face='Courier'>sse_format()</font> helper wraps each event as Server-Sent Events, so the API can stream the debate to the frontend live, one message at a time.")
body("<font face='Courier'>run_debate_blocking()</font> is the synchronous version &mdash; it drains the generator and returns just <font face='Courier'>{consensus, transcript}</font>. This is the variant the board agent calls.")

h2("One detail worth flagging")
body("<font face='Courier'>_stance_for()</font> contains hardcoded heuristic stances based on runway, growth, and churn &mdash; e.g. Competitor is always bearish, and Financial turns bearish when runway is under 8 months. But note it is <b>defined and never called</b> in the current flow; the real stances come from the LLM responses. It looks like a leftover fallback. If stances were meant to be grounded in the metrics rather than left entirely to the model, that function is the unused hook for it.")

h2("How the board consumes it")
body("In <font face='Courier'>board.py</font>, <font face='Courier'>gather_all()</font> runs the debate as one of roughly fourteen agents, then <font face='Courier'>_compact()</font> extracts only <font face='Courier'>debate_consensus</font> into the trimmed summary handed to the Chairperson. So the multi-round argument collapses to a single consensus label by the time the final <font face='Courier'>INVEST&nbsp;|&nbsp;HOLD&nbsp;|&nbsp;PIVOT&nbsp;|&nbsp;WIND_DOWN</font> decision is made.")

gap(4)
story.append(HRFlowable(width="100%", thickness=0.75, color=MUTED))
gap(4)

# Summary table of the flow
h2("At a glance")
data = [
    ["Stage", "What happens", "Who decides"],
    ["Round 1", "Independent opinions, 2-3 sentences + stance", "Each of 6 agents (LLM)"],
    ["Round 2", "Challenge / build on others' positions", "Each agent, sees prior transcript"],
    ["Round 3", "Move to consensus + final recommendation", "Each agent"],
    ["Consensus", "Majority vote over round-3 stances", "Code (max-count), not LLM"],
    ["Board decision", "INVEST / HOLD / PIVOT / WIND_DOWN", "Chairperson (LLM) over all agents"],
]
tbl = Table(data, colWidths=[1.1*inch, 3.2*inch, 2.0*inch])
tbl.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), ACCENT),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
    ("FONTSIZE", (0,0), (-1,-1), 8.5),
    ("FONTNAME", (0,1), (0,-1), "Helvetica-Bold"),
    ("TEXTCOLOR", (0,1), (-1,-1), INK),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, CODEBG]),
    ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#cccccc")),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("TOPPADDING", (0,0), (-1,-1), 5),
    ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ("LEFTPADDING", (0,0), (-1,-1), 7),
]))
story.append(tbl)

doc = SimpleDocTemplate(OUT, pagesize=LETTER,
                        topMargin=0.8*inch, bottomMargin=0.8*inch,
                        leftMargin=0.9*inch, rightMargin=0.9*inch,
                        title="VENTUREGENESIS Board Debate Explained")
doc.build(story)
print("WROTE", OUT)
