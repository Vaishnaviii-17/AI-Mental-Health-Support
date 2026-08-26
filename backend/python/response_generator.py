"""
response_generator.py

Generates conversational, emotionally-attentive responses for a
mental-health support chatbot.

Architecture:

Conversation Analyzer
        ↓
Response Generator
        ↓
Hugging Face Inference API
        ↓
Fallback response system

The response generator does NOT determine:
- topic
- emotion
- risk
- conversation strategy

Those decisions are made by ConversationAnalyzer. The response
generator uses those decisions to produce a natural, warm,
non-repetitive conversational response rather than a mechanical
"reflection + question" pattern.

LLM PROVIDER:
- Hugging Face Inference Providers
- No Ollama
- No local LLM server
- Uses HF_TOKEN environment variable

Default model:
    Qwen/Qwen2.5-72B-Instruct

You can override the model using:

    HF_MODEL

Example:

    $env:HF_TOKEN="hf_xxxxxxxxx"
    $env:HF_MODEL="Qwen/Qwen2.5-72B-Instruct"
"""

from typing import Dict, Any, Optional, List
import os


class ResponseGenerator:

    def __init__(self):

        print("Initializing Response Generator...")

        # =========================================================
        # HUGGING FACE CONFIGURATION
        # =========================================================

        self.hf_token = os.getenv("HF_TOKEN")
        self.hf_model = os.getenv("HF_MODEL", "Qwen/Qwen2.5-72B-Instruct")
        self.llm_enabled = bool(self.hf_token)
        self.hf_client = None

        if self.llm_enabled:
            try:
                from huggingface_hub import InferenceClient

                self.hf_client = InferenceClient(
                    api_key=self.hf_token,
                    provider="auto"
                )

                print(
                    "LLM configuration: "
                    "enabled=True, "
                    "provider=huggingface, "
                    f"model={self.hf_model}"
                )

            except ImportError:
                self.llm_enabled = False
                print(
                    "Hugging Face client not installed. "
                    "Run: pip install -U huggingface_hub"
                )

            except Exception as e:
                self.llm_enabled = False
                print(
                    "Hugging Face initialization failed: "
                    f"{type(e).__name__}: {e}"
                )

        else:
            print(
                "LLM configuration: "
                "enabled=False, "
                "provider=huggingface, "
                "reason=HF_TOKEN not configured"
            )

        # =========================================================
        # CONVERSATIONAL RESPONSE BANKS
        # =========================================================
        #
        # Structure preserved conceptually from the original system:
        #
        #   topic -> strategy -> emotion -> [reflection variants]
        #
        # Reflections themselves no longer end in a question. A
        # question, a validation, a small suggestion, or nothing at
        # all is layered on afterward depending on the chosen
        # conversational "mode", so the conversation does not read
        # like a questionnaire.
        #

        self.topic_labels = {
            "academics": "your studies",
            "family": "your family",
            "relationships": "this relationship",
            "work": "work",
            "self": "how you see yourself",
            "future": "the future",
            "unknown": "what's going on",
        }

        self.emotion_labels = {
            "fear": "fear",
            "anxiety": "anxiety",
            "sadness": "sadness",
            "disappointment": "disappointment",
            "anger": "frustration",
            "joy": "relief",
            "neutral": "uncertainty",
            "default": "this feeling",
        }

        self.topic_change_templates = [
            "It sounds like what's going on with {old} is also tied to {new}.",
            "It seems like {old} and {new} are connected for you right now.",
        ]

        self.emotion_change_templates = [
            "It sounds like the {old} is starting to turn into {new}.",
            "It seems like that {old} is shifting into something closer to {new}.",
        ]

        self.reflections = {

            "academics": {
                "reflect_and_explore": {
                    "fear": [
                        "The fear of failing your exams sounds like it's taking up a lot of space right now.",
                        "That worry about failing seems tied to a lot of pressure you're carrying.",
                    ],
                    "anxiety": [
                        "The uncertainty around your exams sounds like it's keeping you on edge.",
                        "That academic pressure sounds exhausting to sit with.",
                    ],
                    "sadness": [
                        "It sounds like your studies have been weighing on you emotionally.",
                        "That academic pressure seems to be taking a real toll on you.",
                    ],
                    "disappointment": [
                        "It sounds like you're feeling let down by how things are going with your studies.",
                        "That disappointment in yourself around academics sounds heavy to carry.",
                    ],
                    "anger": [
                        "It sounds like something about your studies is really frustrating you.",
                        "That frustration with how things are going academically makes sense.",
                    ],
                    "joy": [
                        "That's good to hear — sounds like things are coming together with your studies.",
                        "It's nice that your academic work is going in a direction that feels good.",
                    ],
                    "neutral": [
                        "It sounds like your studies are on your mind right now.",
                        "There's clearly something about your academic situation you're working through.",
                    ],
                    "default": [
                        "It sounds like your studies are putting a fair amount of pressure on you.",
                        "There's a lot riding on your academics right now, from the sound of it.",
                    ],
                },
                "reflect_and_follow": {
                    "fear": [
                        "That fear about failing still seems to be sitting with you.",
                        "It sounds like this worry about your exams hasn't let up.",
                    ],
                    "anxiety": [
                        "That exam anxiety sounds like it's still very present.",
                        "It sounds like the pressure around your studies hasn't eased.",
                    ],
                    "sadness": [
                        "It sounds like this academic pressure is still weighing on you.",
                        "That heaviness around your studies seems to be sticking around.",
                    ],
                    "disappointment": [
                        "That disappointment about your academics still seems to be with you.",
                        "It sounds like you're still carrying some frustration with how things are going.",
                    ],
                    "anger": [
                        "That frustration with your studies sounds like it's still there.",
                        "It sounds like this academic situation is still getting to you.",
                    ],
                    "joy": [
                        "It's good that things are still feeling better with your studies.",
                        "Sounds like that positive momentum with your academics is continuing.",
                    ],
                    "neutral": [
                        "This academic situation still seems to be on your mind.",
                        "It sounds like your studies are still something you're working through.",
                    ],
                    "default": [
                        "It sounds like this academic pressure is still with you.",
                        "That situation with your studies seems to be continuing to weigh on you.",
                    ],
                },
            },

            "family": {
                "reflect_and_explore": {
                    "fear": [
                        "It sounds like you're afraid of disappointing your parents.",
                        "That worry about how your family might react sounds like a lot to carry.",
                    ],
                    "sadness": [
                        "It sounds painful to feel like you might let your parents down.",
                        "That sadness around your family's expectations makes sense.",
                    ],
                    "disappointment": [
                        "It sounds like the thought of disappointing your parents is weighing on you.",
                        "That pressure from your family's expectations sounds heavy.",
                    ],
                    "anger": [
                        "It sounds like being compared to others by your family is frustrating.",
                        "That frustration with your parents' expectations makes sense.",
                    ],
                    "joy": [
                        "It's good to hear things feel lighter with your family right now.",
                        "That sounds like a nice shift in how things feel with your parents.",
                    ],
                    "neutral": [
                        "Your family clearly has a strong influence on how you're feeling about this.",
                        "It sounds like there's something about your parents' expectations you're working through.",
                    ],
                    "default": [
                        "It sounds like your family's expectations are putting a lot of pressure on you.",
                        "That relationship with your parents seems connected to a lot of what you're feeling.",
                    ],
                },
                "reflect_and_follow": {
                    "fear": [
                        "That worry about your parents' reaction still seems to be there.",
                        "It sounds like this fear connected to your family hasn't eased.",
                    ],
                    "sadness": [
                        "It sounds like this is still emotionally difficult with your family.",
                        "That hurt around your parents' expectations still seems to be present.",
                    ],
                    "disappointment": [
                        "It sounds like their expectations are still affecting how you see yourself.",
                        "That disappointment tied to your family still seems to be with you.",
                    ],
                    "anger": [
                        "That frustration with your family's comparisons still seems to be there.",
                        "It sounds like this is still getting under your skin.",
                    ],
                    "joy": [
                        "It's good that things are still feeling better with your family.",
                        "That improvement with your parents sounds like it's continuing.",
                    ],
                    "neutral": [
                        "This is clearly still something you're working through with your family.",
                        "It sounds like your parents are still very much on your mind.",
                    ],
                    "default": [
                        "It sounds like this family pressure is still affecting you.",
                        "That situation with your parents still seems to be weighing on you.",
                    ],
                },
            },

            "relationships": {
                "reflect_and_explore": {
                    "sadness": [
                        "It sounds like you've been hurt by what happened in this relationship.",
                        "That sounds like a painful thing to be carrying about this relationship.",
                    ],
                    "fear": [
                        "It sounds like you're worried about losing this relationship.",
                        "That uncertainty around this relationship sounds unsettling.",
                    ],
                    "anger": [
                        "It sounds like what happened has left you frustrated.",
                        "That frustration toward this person makes sense given what happened.",
                    ],
                    "disappointment": [
                        "It sounds like this relationship hasn't gone the way you hoped.",
                        "That disappointment about how things turned out makes sense.",
                    ],
                    "joy": [
                        "That's really nice to hear — sounds like things are going well.",
                        "It sounds like this relationship is in a good place right now.",
                    ],
                    "neutral": [
                        "This relationship clearly matters to you.",
                        "There's something about this relationship you're trying to make sense of.",
                    ],
                    "default": [
                        "It sounds like this relationship has been difficult for you.",
                        "There's a lot going on in this relationship, from the sound of it.",
                    ],
                },
                "reflect_and_follow": {
                    "sadness": [
                        "That hurt from this relationship still seems to be with you.",
                        "It sounds like this is still weighing on you.",
                    ],
                    "fear": [
                        "That uncertainty about this relationship still seems present.",
                        "It sounds like the worry hasn't let up.",
                    ],
                    "anger": [
                        "That frustration about what happened still seems to be there.",
                        "It sounds like this is still bothering you.",
                    ],
                    "joy": [
                        "It's good that things are still going well.",
                        "Sounds like that positive feeling about the relationship is continuing.",
                    ],
                    "default": [
                        "It sounds like this relationship is still on your mind.",
                        "That situation seems to be staying with you.",
                    ],
                },
            },

            "work": {
                "reflect_and_explore": {
                    "anxiety": [
                        "It sounds like work is creating a lot of anxiety for you right now.",
                        "That pressure at work sounds like it's been building up.",
                    ],
                    "fear": [
                        "It sounds like you're worried about what might happen at work.",
                        "That uncertainty around your job sounds unsettling.",
                    ],
                    "sadness": [
                        "It sounds like work has been taking a real emotional toll on you.",
                        "That work situation seems to be affecting your mood.",
                    ],
                    "anger": [
                        "It sounds like something at work is really frustrating you.",
                        "That situation at work sounds genuinely unfair.",
                    ],
                    "joy": [
                        "That's great to hear — sounds like work is going well.",
                        "Sounds like things are looking up at work.",
                    ],
                    "neutral": [
                        "Work is clearly on your mind right now.",
                        "There's something about your job you're working through.",
                    ],
                    "default": [
                        "It sounds like your responsibilities at work have become hard to manage.",
                        "That workload sounds like it's taking a lot out of you.",
                    ],
                },
                "reflect_and_follow": {
                    "anxiety": [
                        "That work anxiety still seems to be with you.",
                        "It sounds like the pressure at work hasn't eased.",
                    ],
                    "fear": [
                        "That worry about work still seems present.",
                        "It sounds like this uncertainty at work is continuing.",
                    ],
                    "joy": [
                        "It's good that work is still feeling positive.",
                        "Sounds like that momentum at work is continuing.",
                    ],
                    "default": [
                        "It sounds like work is still weighing on you.",
                        "That situation at work seems to be continuing.",
                    ],
                },
            },

            "self": {
                "reflect_and_explore": {
                    "disappointment": [
                        "It sounds like you're feeling disappointed in yourself.",
                        "That feeling of falling short sounds painful.",
                    ],
                    "sadness": [
                        "It sounds like this is affecting how you see yourself.",
                        "That sadness about yourself sounds heavy to carry.",
                    ],
                    "fear": [
                        "It sounds like there's a fear tied to not meeting your own expectations.",
                        "That fear about yourself seems connected to a lot of pressure.",
                    ],
                    "joy": [
                        "It's really nice to hear you feeling good about yourself right now.",
                        "That sounds like a good moment of confidence for you.",
                    ],
                    "neutral": [
                        "It sounds like you're working through how you see yourself.",
                        "There's something about your self-image you're trying to figure out.",
                    ],
                    "default": [
                        "It sounds like these doubts are affecting how you see yourself.",
                        "That self-doubt sounds like it's been weighing on you.",
                    ],
                },
                "reflect_and_follow": {
                    "disappointment": [
                        "Those thoughts about not being good enough still seem to be there.",
                        "That self-doubt seems to be continuing.",
                    ],
                    "sadness": [
                        "It sounds like you're still struggling with how you see yourself.",
                        "That feeling seems to still be weighing on you.",
                    ],
                    "joy": [
                        "It's good that you're still feeling good about yourself.",
                        "That confidence seems to be sticking around.",
                    ],
                    "default": [
                        "It sounds like these doubts are still with you.",
                        "That feeling about yourself seems to be continuing.",
                    ],
                },
            },

            "future": {
                "reflect_and_explore": {
                    "fear": [
                        "It sounds like uncertainty about the future is frightening for you.",
                        "Not knowing what comes next sounds like it's creating real fear.",
                    ],
                    "anxiety": [
                        "It sounds like you're anxious about what's coming next.",
                        "That uncertainty about the future sounds hard to sit with.",
                    ],
                    "sadness": [
                        "It sounds like thinking about the future has been emotionally difficult.",
                        "That sense of hopelessness about what's ahead sounds heavy.",
                    ],
                    "joy": [
                        "That's good to hear — sounds like you're feeling more hopeful about what's ahead.",
                        "It sounds like the future feels a bit brighter right now.",
                    ],
                    "neutral": [
                        "It sounds like you're thinking seriously about your future.",
                        "There's something about what's ahead that's on your mind.",
                    ],
                    "default": [
                        "It sounds like uncertainty about the future is weighing on you.",
                        "Not knowing what's ahead sounds like it's creating some pressure.",
                    ],
                },
                "reflect_and_follow": {
                    "fear": [
                        "That uncertainty about the future still seems to be frightening.",
                        "It sounds like this fear about what's ahead hasn't eased.",
                    ],
                    "anxiety": [
                        "That anxiety about the future still seems present.",
                        "It sounds like the uncertainty is continuing to weigh on you.",
                    ],
                    "joy": [
                        "It's good that hopeful feeling about the future is continuing.",
                        "Sounds like that sense of optimism is sticking around.",
                    ],
                    "default": [
                        "It sounds like this uncertainty is still on your mind.",
                        "That concern about the future seems to be continuing.",
                    ],
                },
            },

            "unknown": {
                "reflect_and_explore": {
                    "fear": [
                        "It sounds like something is making you feel afraid.",
                        "There's something weighing on you that sounds frightening.",
                    ],
                    "sadness": [
                        "It sounds like you're going through something difficult.",
                        "There's clearly a lot on your mind right now.",
                    ],
                    "anxiety": [
                        "It sounds like something has been making you anxious.",
                        "There's a lot on your mind, from the sound of it.",
                    ],
                    "anger": [
                        "It sounds like something is really frustrating you right now.",
                        "That frustration makes sense given what you're dealing with.",
                    ],
                    "joy": [
                        "That's really good to hear.",
                        "It's nice to hear things are going well for you.",
                    ],
                    "neutral": [
                        "There's something you're working through right now.",
                        "It sounds like there's a lot going on for you.",
                    ],
                    "default": [
                        "It sounds like there's a lot going on for you right now.",
                        "There's clearly something weighing on you.",
                    ],
                },
                "reflect_and_follow": {
                    "fear": [
                        "That worry still seems to be with you.",
                        "It sounds like this is still on your mind.",
                    ],
                    "sadness": [
                        "It sounds like this is still affecting you.",
                        "That heaviness still seems to be there.",
                    ],
                    "anxiety": [
                        "It sounds like this is still weighing on you.",
                        "That feeling seems to be continuing.",
                    ],
                    "joy": [
                        "It's good that things are still feeling positive.",
                        "Sounds like that good feeling is sticking around.",
                    ],
                    "default": [
                        "It sounds like this is still on your mind.",
                        "That situation seems to be continuing to affect you.",
                    ],
                },
            },
        }

        self.validations = {
            "academics": [
                "It makes sense that this would feel like a lot right now.",
                "Anyone juggling this much would feel some pressure.",
            ],
            "family": [
                "It's understandable to feel this way when family expectations are involved.",
                "That's a heavy thing to carry, especially with people whose opinion matters to you.",
            ],
            "relationships": [
                "That's a natural way to feel when something like this happens.",
                "It makes sense this would be hard to sit with.",
            ],
            "work": [
                "That's a lot to manage, and it makes sense it feels heavy.",
                "Anyone in that position would likely feel the same pressure.",
            ],
            "self": [
                "It's understandable to feel this way about yourself sometimes.",
                "That's a hard place to be in, and a very human one.",
            ],
            "future": [
                "It's natural to feel unsettled when so much feels uncertain.",
                "That's a reasonable way to feel about something you can't fully control.",
            ],
            "unknown": [
                "That's a completely understandable way to feel.",
                "It makes sense that this would affect you.",
            ],
            "default": [
                "That's a very understandable reaction.",
                "It makes sense you'd feel this way.",
            ],
        }

        self.suggestions = {
            "academics": [
                "You don't need to solve everything tonight — picking just one task to start with might make the rest feel lighter.",
                "It might help to focus on whichever assignment feels most urgent, rather than all of them at once.",
            ],
            "family": [
                "It might help to give yourself permission to define success on your own terms, even if it looks different from what's expected.",
                "Sometimes it helps to separate what you want from what you think others want for you.",
            ],
            "relationships": [
                "It might help to give yourself a little space before deciding what to do next.",
                "Sometimes talking it through with someone you trust can make things feel less tangled.",
            ],
            "work": [
                "It might help to pick one thing to tackle first instead of trying to handle it all at once.",
                "A short break, even a brief one, can sometimes make the workload feel more manageable.",
            ],
            "self": [
                "It might help to notice when that inner critic gets loud, and gently question whether it's being fair to you.",
                "Small wins can sometimes shift how you see yourself, even when they feel minor.",
            ],
            "future": [
                "It might help to focus on just the next small step, rather than the whole picture.",
                "Sometimes it helps to separate what you can influence now from what's still uncertain.",
            ],
            "unknown": [
                "It might help to take things one piece at a time rather than all at once.",
                "Sometimes a short pause can make things feel a bit more manageable.",
            ],
            "default": [
                "You don't have to figure everything out right now.",
                "Taking it one step at a time can sometimes make things feel lighter.",
            ],
        }

        self.questions = {
            "academics": [
                "If it helps, we could figure out which part feels most urgent to tackle first.",
                "Would it help to talk through which task is weighing on you the most?",
            ],
            "family": [
                "Is there a part of this you wish your family understood better?",
                "Would it help to talk about what you'd want them to see differently?",
            ],
            "relationships": [
                "Is there a part of this you're still trying to make sense of?",
                "Would it help to talk through what you'd want to happen next?",
            ],
            "work": [
                "Is there one part of the workload that feels most pressing right now?",
                "Would it help to talk through what's making it feel unmanageable?",
            ],
            "self": [
                "Is there a moment recently where you felt a little differently about yourself?",
                "Would it help to talk about where that feeling tends to come from?",
            ],
            "future": [
                "Is there one decision that feels most important to figure out first?",
                "Would it help to talk through what feels most uncertain right now?",
            ],
            "unknown": [
                "Is there a part of this you'd like to talk through more?",
                "What feels most important to focus on right now?",
            ],
            "default": [
                "Is there a part of this that feels most important to talk through?",
                "Would it help to unpack this a little more?",
            ],
        }

        self.simple_responses = [
            "Yeah, that sounds like one of those days where nothing quite goes to plan.",
            "That's okay — you don't have to have everything figured out right now.",
            "Those slow, uneventful stretches can feel surprisingly flat.",
            "That sounds like a nice way to let your mind switch off for a bit.",
            "Fair enough — some days just feel like that.",
        ]

        # Kept for backward compatibility in case any other module
        # inspects this attribute directly.
        self.fallback_responses = self.reflections

    # =========================================================
    # PUBLIC METHOD
    # =========================================================

    def generate(
        self,
        analysis: Dict[str, Any],
        state=None
    ) -> str:

        """
        Generate the next conversational response.

        Parameters
        ----------
        analysis:
            Analysis dictionary produced by ConversationAnalyzer.

        state:
            ConversationState object.

        Returns
        -------
        str
            Assistant response.
        """

        if not isinstance(analysis, dict):
            raise ValueError("analysis must be a dictionary")

        # =====================================================
        # EXTRACT ANALYSIS
        # =====================================================

        user_text = analysis.get("text", "")
        topic = analysis.get("topic") or "unknown"
        emotion = analysis.get("emotion")
        strategy = analysis.get("strategy", "reflect_and_explore")

        # Optional continuity signals. These may or may not be
        # provided by ConversationAnalyzer; if absent, the
        # conversation simply proceeds without an explicit
        # topic/emotion-change acknowledgment.
        previous_topic = (
            analysis.get("previous_topic")
            or analysis.get("prior_topic")
        )
        previous_emotion = (
            analysis.get("previous_emotion")
            or analysis.get("prior_emotion")
        )

        # =====================================================
        # EXTRACT RISK
        # =====================================================

        risk = analysis.get("risk")
        risk_level = None

        if isinstance(risk, dict):
            risk_level = risk.get("risk_level") or risk.get("level")
        elif isinstance(risk, str):
            risk_level = risk

        # =====================================================
        # NORMALIZE VALUES
        # =====================================================

        topic = self._normalize_topic(topic)
        emotion = self._normalize_emotion(emotion)
        strategy = self._normalize_strategy(strategy)
        risk_level = self._normalize_risk(risk_level)

        if previous_topic:
            previous_topic = self._normalize_topic(previous_topic)

        if previous_emotion:
            previous_emotion = self._normalize_emotion(previous_emotion)

        # =====================================================
        # CONVERSATION HISTORY
        # =====================================================

        conversation_history = []

        if state is not None:
            try:
                conversation_history = state.get_recent_history(limit=8)
            except Exception:
                conversation_history = getattr(state, "history", [])

        # =====================================================
        # TRY HUGGING FACE LLM
        # =====================================================

        try:
            response = self._generate_with_llm(
                user_text=user_text,
                topic=topic,
                emotion=emotion,
                strategy=strategy,
                risk_level=risk_level,
                conversation_history=conversation_history,
                analysis=analysis,
                previous_topic=previous_topic,
                previous_emotion=previous_emotion,
            )

            if response:
                response = response.strip()
                if response:
                    return response

        except Exception as e:
            print(
                "Hugging Face LLM response generation failed: "
                f"{type(e).__name__}: {e}"
            )

        # =====================================================
        # FALLBACK RESPONSE
        # =====================================================

        return self._fallback_response(
            topic=topic,
            emotion=emotion,
            strategy=strategy,
            risk_level=risk_level,
            conversation_history=conversation_history,
            user_text=user_text,
            previous_topic=previous_topic,
            previous_emotion=previous_emotion,
        )

    # =========================================================
    # NORMALIZATION
    # =========================================================

    def _normalize_topic(self, topic: Optional[str]) -> str:

        if not topic:
            return "unknown"

        topic = str(topic).strip().lower()

        aliases = {
            "academic": "academics",
            "education": "academics",
            "study": "academics",
            "studies": "academics",
            "school": "academics",
            "college": "academics",
            "relationship": "relationships",
            "romantic": "relationships",
            "job": "work",
            "career": "work",
            "personal": "self",
            "self-esteem": "self",
            "self_doubt": "self",
        }

        return aliases.get(topic, topic)

    def _normalize_emotion(self, emotion: Optional[str]) -> str:

        if not emotion:
            return "default"

        emotion = str(emotion).strip().lower()

        aliases = {
            "worry": "anxiety",
            "worried": "anxiety",
            "nervous": "anxiety",
            "nervousness": "anxiety",
            "fearful": "fear",
            "scared": "fear",
            "sad": "sadness",
            "grief": "sadness",
            "disappointed": "disappointment",
            "remorse": "disappointment",
            "embarrassment": "disappointment",
            "angry": "anger",
            "annoyance": "anger",
            "disgust": "anger",
            "disapproval": "anger",
            "happy": "joy",
            "happiness": "joy",
            "admiration": "joy",
            "amusement": "joy",
            "approval": "joy",
            "caring": "joy",
            "desire": "joy",
            "excitement": "joy",
            "gratitude": "joy",
            "love": "joy",
            "optimism": "joy",
            "pride": "joy",
            "relief": "joy",
            "confusion": "neutral",
            "curiosity": "neutral",
            "realization": "neutral",
            "surprise": "neutral",
        }

        return aliases.get(emotion, emotion)

    def _normalize_strategy(self, strategy: Optional[str]) -> str:

        valid_strategies = ("reflect_and_explore", "reflect_and_follow")

        if strategy in valid_strategies:
            return strategy

        return "reflect_and_explore"

    def _normalize_risk(self, risk_level: Optional[str]) -> Optional[str]:

        if not risk_level:
            return None

        risk_level = str(risk_level).strip().lower()

        aliases = {
            "minimal": "low",
            "moderate": "medium",
            "elevated": "medium",
            "high_risk": "high",
        }

        return aliases.get(risk_level, risk_level)

    # =========================================================
    # HUGGING FACE LLM GENERATION
    # =========================================================

    def _generate_with_llm(
        self,
        user_text: str,
        topic: str,
        emotion: str,
        strategy: str,
        risk_level: Optional[str],
        conversation_history: List[Dict[str, Any]],
        analysis: Dict[str, Any],
        previous_topic: Optional[str] = None,
        previous_emotion: Optional[str] = None,
    ) -> Optional[str]:

        """
        Generate a natural response using Hugging Face Inference
        Providers.

        The LLM does NOT perform topic/emotion/risk classification
        or strategy selection — those decisions have already been
        made by ConversationAnalyzer. This method only turns those
        decisions into a natural, non-repetitive conversational
        reply.

        If Hugging Face is unavailable, this method returns None and
        the fallback response system is used instead.
        """

        if not self.llm_enabled or self.hf_client is None:
            return None

        # =====================================================
        # HIGH RISK
        # =====================================================
        #
        # Do not ask the general LLM to improvise crisis handling.
        # The existing deterministic high-risk response remains
        # authoritative.
        #

        if risk_level == "high":
            return None

        # =====================================================
        # BUILD HISTORY
        # =====================================================

        history_messages = []

        if isinstance(conversation_history, list):
            for item in conversation_history:

                if not isinstance(item, dict):
                    continue

                role = item.get("role")

                if role == "user":
                    content = (
                        item.get("user")
                        or item.get("text")
                        or item.get("content")
                    )
                    if content:
                        history_messages.append(
                            {"role": "user", "content": str(content)}
                        )

                elif role == "assistant":
                    content = (
                        item.get("assistant")
                        or item.get("response")
                        or item.get("content")
                    )
                    if content:
                        history_messages.append(
                            {"role": "assistant", "content": str(content)}
                        )

        history_messages = history_messages[-8:]

        # =====================================================
        # SYSTEM PROMPT
        # =====================================================

        system_prompt = """
You are the response-generation component of a mental-health
support conversational application. You are a warm, calm,
emotionally attentive conversational companion — not an
interviewer, not a therapist conducting an assessment, and not a
scripted survey.

The application has already determined:
- the conversation topic
- the user's detected emotion
- the conversation strategy
- the risk level

Do NOT reclassify these things.

Do NOT diagnose the user.

Do NOT claim to be a therapist, psychologist, psychiatrist, doctor,
other healthcare professional, or a human being.

Do NOT provide a diagnosis or make medical claims.

Do NOT invent facts or assume details the user did not provide.

Use the supplied conversation history to maintain real continuity —
refer back to what the user has actually said, don't restart the
conversation with each message.

HOW TO CONVERSE:

1. Listen before questioning. Your first job in every response is
   to show the user you understood what they just said, in your own
   words — not a restatement, a genuine reflection.

2. Reflection matters far more than questioning. Most responses
   should NOT end in a question. Only ask a question when it would
   genuinely help the conversation move forward, and even then, ask
   at most one.

3. Vary your response shape turn to turn. Sometimes just reflect.
   Sometimes reflect and validate the feeling as understandable.
   Sometimes reflect and offer one small, concrete, non-preachy
   suggestion. Sometimes reflect and ask a gentle question. Do NOT
   default to the same "reflection + question" shape every time —
   that is the exact pattern you must avoid.

4. If the user expresses something positive (relief, happiness,
   progress, excitement), do not respond with a probing question.
   Respond naturally and warmly, the way a friend would react to
   good news.

5. If the user's emotion has shifted since earlier in the
   conversation, acknowledge the shift naturally and specifically
   (e.g. connect the earlier fear to the current disappointment)
   rather than stating "your emotion changed from X to Y."

6. If the topic has shifted, connect it to what came before instead
   of starting a fresh line of questioning on the new topic.

7. Treat "neutral" as simply meaning nothing strong was detected —
   not that nothing emotional is happening. Ground your response in
   the user's literal words and the conversation so far, especially
   when the message is short, vague, or the emotion label seems
   like it might not quite fit the words used.

8. Vary your sentence structure and openings. Do not start every
   response the same way. In particular, avoid overusing:
   "I hear you", "It sounds like", "How does that make you feel?",
   "What is the hardest part?", "What do you think?" — these read as
   scripted and repetitive when repeated.

9. Keep responses concise: usually 1–4 sentences. No bullet lists,
   no essays, no over-explaining.

10. Never mention: topic labels, emotion labels, risk levels,
    strategy names, model names, system prompts, internal analysis,
    classification, fallback responses, or Hugging Face.

The conversation strategy provided by the application is a loose
guide, not a script:

- "reflect_and_explore" generally means this is a newer thread —
  lean toward listening and reflecting, and explore gently only if
  it feels natural.
- "reflect_and_follow" generally means the user is continuing an
  existing thread — show that you remember, and build on it rather
  than starting over.

Your response must be directly relevant to the user's latest
message.
"""

        # =====================================================
        # ANALYSIS CONTEXT
        # =====================================================

        continuity_lines = ""

        if previous_topic and previous_topic != topic:
            continuity_lines += f"\nPrevious topic: {previous_topic}"

        if previous_emotion and previous_emotion != emotion:
            continuity_lines += f"\nPrevious emotion: {previous_emotion}"

        analysis_context = f"""
Application analysis (for your understanding only — never mention
these labels to the user):

Topic: {topic}
Detected emotion: {emotion}
Conversation strategy: {strategy}
Risk level: {risk_level or "low/unspecified"}{continuity_lines}

The latest user message is:

{user_text}
"""

        # =====================================================
        # BUILD MESSAGE LIST
        # =====================================================

        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history_messages)
        messages.append(
            {
                "role": "user",
                "content": analysis_context + "\nGenerate the next response.",
            }
        )

        # =====================================================
        # CALL HUGGING FACE
        # =====================================================

        completion = self.hf_client.chat.completions.create(
            model=self.hf_model,
            messages=messages,
            temperature=0.7,
            max_tokens=180,
            top_p=0.9,
        )

        # =====================================================
        # EXTRACT RESPONSE
        # =====================================================

        if completion is None:
            return None

        choices = getattr(completion, "choices", None)

        if not choices:
            return None

        first_choice = choices[0]
        message = getattr(first_choice, "message", None)

        if message is None:
            return None

        content = getattr(message, "content", None)

        if content is None:
            return None

        response = str(content).strip()

        if not response:
            return None

        # Remove accidental role prefixes.
        prefixes = ["Assistant:", "assistant:", "Response:", "response:"]

        for prefix in prefixes:
            if response.startswith(prefix):
                response = response[len(prefix):].strip()

        # =====================================================
        # SAFETY / QUALITY GUARDS
        # =====================================================

        if not self._is_valid_llm_response(response=response, user_text=user_text):
            print(
                "Hugging Face returned a response that failed "
                "validation. Using fallback."
            )
            return None

        return response

    # =========================================================
    # LLM RESPONSE VALIDATION
    # =========================================================

    def _is_valid_llm_response(self, response: str, user_text: str) -> bool:

        """
        Lightweight output validation.

        This is NOT a replacement for a dedicated safety layer. It
        simply prevents obviously malformed or meta-leaking
        responses from being returned to the user.
        """

        if not response:
            return False

        if len(response) < 5:
            return False

        if len(response) > 1200:
            return False

        forbidden_phrases = [
            "as an ai language model",
            "as an ai",
            "according to the system prompt",
            "system prompt",
            "internal analysis",
            "risk level",
            "detected emotion",
            "conversation strategy",
            "topic classification",
            "fallback response",
            "hugging face",
            "ollama",
            "qwen2.5",
            "qwen3",
        ]

        response_lower = response.lower()

        for phrase in forbidden_phrases:
            if phrase in response_lower:
                return False

        invalid_exact = {
            "okay",
            "ok",
            "sure",
            "i understand",
            "understood",
            "noted",
        }

        if response_lower in invalid_exact:
            return False

        return True

    # =========================================================
    # FALLBACK RESPONSE
    # =========================================================

    def _fallback_response(
        self,
        topic: str,
        emotion: str,
        strategy: str,
        risk_level: Optional[str],
        conversation_history: List[Dict[str, Any]],
        user_text: str,
        previous_topic: Optional[str] = None,
        previous_emotion: Optional[str] = None,
    ) -> str:

        # =====================================================
        # SAFETY-AWARE RESPONSES
        # =====================================================

        if risk_level == "high":
            return self._high_risk_response(topic=topic)

        # =====================================================
        # BASE REFLECTION
        # =====================================================
        #
        # If the topic or emotion has genuinely shifted since the
        # last turn, acknowledge that shift naturally instead of
        # restarting the conversation on the new label. Otherwise,
        # pull a reflection from the topic/strategy/emotion bank.
        #

        reflection = None

        if (
            previous_topic
            and previous_topic != topic
            and topic in self.topic_labels
            and previous_topic in self.topic_labels
        ):
            template = self._pick(self.topic_change_templates, conversation_history)
            reflection = template.format(
                old=self.topic_labels[previous_topic],
                new=self.topic_labels[topic],
            )

        elif (
            previous_emotion
            and previous_emotion != emotion
            and emotion in self.emotion_labels
            and previous_emotion in self.emotion_labels
        ):
            template = self._pick(self.emotion_change_templates, conversation_history)
            reflection = template.format(
                old=self.emotion_labels[previous_emotion],
                new=self.emotion_labels[emotion],
            )

        if not reflection:
            reflection = self._get_reflection(
                topic=topic,
                strategy=strategy,
                emotion=emotion,
                conversation_history=conversation_history,
            )

        # =====================================================
        # CHOOSE CONVERSATIONAL MODE
        # =====================================================

        mode = self._choose_mode(
            conversation_history=conversation_history,
            topic=topic,
            emotion=emotion,
        )

        if mode == "reflection":
            return reflection

        if mode == "validation":
            addition = self._pick(
                self.validations.get(topic, self.validations["default"]),
                conversation_history,
            )
            return f"{reflection} {addition}"

        if mode == "suggestion":
            addition = self._pick(
                self.suggestions.get(topic, self.suggestions["default"]),
                conversation_history,
            )
            return f"{reflection} {addition}"

        if mode == "question":
            addition = self._pick(
                self.questions.get(topic, self.questions["default"]),
                conversation_history,
            )
            return f"{reflection} {addition}"

        if mode == "simple":
            return self._pick(self.simple_responses, conversation_history)

        return reflection

    # =========================================================
    # REFLECTION LOOKUP
    # =========================================================

    def _get_reflection(
        self,
        topic: str,
        strategy: str,
        emotion: str,
        conversation_history: List[Dict[str, Any]],
    ) -> str:

        topic_bank = self.reflections.get(topic, self.reflections["unknown"])

        strategy_bank = topic_bank.get(
            strategy,
            topic_bank.get("reflect_and_explore", {}),
        )

        responses = strategy_bank.get(emotion)

        if not responses:
            responses = strategy_bank.get("default")

        if not responses:
            responses = self.reflections["unknown"]["reflect_and_explore"]["default"]

        return self._pick(responses, conversation_history)

    # =========================================================
    # CONVERSATIONAL MODE SELECTION
    # =========================================================

    def _choose_mode(
        self,
        conversation_history: List[Dict[str, Any]],
        topic: str,
        emotion: str,
    ) -> str:

        """
        Choose how the reflection should be extended this turn.

        Rotates through modes so responses do not mechanically
        alternate between "reflection" and "reflection + question."
        Questions are deliberately infrequent.
        """

        assistant_count = sum(
            1
            for item in conversation_history
            if isinstance(item, dict) and item.get("role") == "assistant"
        )

        recent = self._get_recent_assistant_responses(conversation_history, limit=2)
        last_had_question = bool(recent) and recent[0].strip().endswith("?")

        cycle = [
            "reflection",
            "validation",
            "reflection",
            "suggestion",
            "reflection",
            "question",
            "reflection",
            "simple",
        ]

        mode = cycle[assistant_count % len(cycle)]

        # Never ask two questions back to back.
        if mode == "question" and last_had_question:
            mode = "reflection"

        # Positive emotions don't need a probing follow-up.
        if emotion == "joy" and mode == "question":
            mode = "reflection"

        # "Simple" (topic-agnostic) responses only make sense for
        # vague/neutral turns or when no topic has been identified.
        if mode == "simple" and not (topic == "unknown" or emotion in ("neutral", "default")):
            mode = "reflection"

        return mode

    # =========================================================
    # GENERIC ROTATION HELPERS
    # =========================================================

    def _pick(
        self,
        responses: List[str],
        conversation_history: List[Dict[str, Any]],
    ) -> str:

        if not responses:
            return ""

        recent_responses = self._get_recent_assistant_responses(conversation_history)

        available = [r for r in responses if r not in recent_responses]

        if not available:
            available = responses

        return self._select_response(available, conversation_history)

    def _select_response(
        self,
        responses: List[str],
        conversation_history: List[Dict[str, Any]],
    ) -> str:

        """
        Select a response without always returning index 0.

        Uses conversation length to provide deterministic rotation.
        """

        if not responses:
            return (
                "It sounds like this has been difficult for you. "
                "What feels most important to talk about right now?"
            )

        assistant_count = sum(
            1
            for item in conversation_history
            if isinstance(item, dict) and item.get("role") == "assistant"
        )

        index = assistant_count % len(responses)

        return responses[index]

    def _get_recent_assistant_responses(
        self,
        conversation_history: List[Dict[str, Any]],
        limit: int = 4,
    ) -> List[str]:

        responses = []

        for item in reversed(conversation_history):

            if not isinstance(item, dict):
                continue

            if item.get("role") != "assistant":
                continue

            response = (
                item.get("assistant")
                or item.get("response")
                or item.get("content")
            )

            if response:
                responses.append(response)

            if len(responses) >= limit:
                break

        return responses

    # =========================================================
    # HIGH RISK RESPONSE
    # =========================================================

    def _high_risk_response(self, topic: str) -> str:

        """
        Conservative response for high-risk situations.

        Detailed crisis handling should eventually be implemented as
        a dedicated safety component rather than relying only on the
        response generator. This response is intentionally direct
        rather than casual.
        """

        return (
            "It sounds like you're going through something very "
            "difficult right now. Your safety is more important "
            "than solving everything at once. Are you in immediate "
            "danger of hurting yourself or someone else right now?"
        )