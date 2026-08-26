"""
response_generator.py

Generates therapeutic-style conversational responses.

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

Those decisions are made by ConversationAnalyzer.

The response generator uses those decisions to produce
a natural conversational response.

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

        self.hf_model = os.getenv(
            "HF_MODEL",
            "Qwen/Qwen2.5-72B-Instruct"
        )

        self.llm_enabled = bool(self.hf_token)

        self.hf_client = None

        # ---------------------------------------------------------
        # Initialize Hugging Face client
        # ---------------------------------------------------------

        if self.llm_enabled:

            try:

                from huggingface_hub import InferenceClient

                self.hf_client = InferenceClient(
                    api_key=self.hf_token,
                    provider="auto"
                )

                print(
                    "LLM configuration: "
                    f"enabled=True, "
                    f"provider=huggingface, "
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
        # RESPONSE BANK
        # =========================================================
        #
        # Existing fallback system is intentionally preserved.
        #
        # Structure:
        #
        # topic
        #   └── strategy
        #         └── emotion
        #
        # Emotion-specific responses are preferred.
        # Topic/strategy responses are used as fallback.
        #

        self.fallback_responses = {

            # =====================================================
            # ACADEMICS
            # =====================================================

            "academics": {

                "reflect_and_explore": {

                    "fear": [
                        "It sounds like the possibility of failing is really frightening you. What worries you most when you think about the exams?",
                        "Failing seems to be carrying a lot of fear for you. Is it the exam itself that worries you most, or what you think might happen afterward?",
                        "It sounds like you're under a lot of pressure around your exams. What part of the situation feels hardest to handle right now?"
                    ],

                    "anxiety": [
                        "It sounds like the uncertainty around your exams is making you anxious. What part of studying or the exams feels most overwhelming?",
                        "That kind of academic pressure can be exhausting. What tends to make your anxiety strongest when you think about your exams?"
                    ],

                    "sadness": [
                        "It sounds like the pressure around your studies is really weighing on you. What has been making this feel especially difficult lately?",
                        "It seems like your academic situation has been affecting you emotionally. What part of it has been hardest for you?"
                    ],

                    "disappointment": [
                        "It sounds like you're feeling disappointed in yourself because of how things are going academically. What makes you feel you've fallen short?",
                        "It seems like your studies have affected how you're seeing yourself. What are you most disappointed about right now?"
                    ],

                    "neutral": [
                        "It sounds like your exams are an important concern for you. What is worrying you most about them?",
                        "It seems like there is something about your studies that you want to work through. What feels most difficult right now?"
                    ],

                    "default": [
                        "It sounds like your studies are putting a lot of pressure on you. What part of the situation feels most overwhelming right now?",
                        "It seems like your exams have been weighing on your mind. What worries you the most about them?"
                    ]
                },

                "reflect_and_follow": {

                    "fear": [
                        "That fear of failing sounds like it is staying on your mind. When those thoughts come up, what do you usually tell yourself?",
                        "It sounds like the fear is still affecting you. Does it make it harder to study, concentrate, or relax?"
                    ],

                    "anxiety": [
                        "It sounds like the exam anxiety is continuing. When does it tend to become strongest?",
                        "That pressure seems to be staying with you. How has the anxiety been affecting your studying or daily life?"
                    ],

                    "sadness": [
                        "It sounds like this academic pressure is still weighing on you. How has it been affecting you outside of studying?",
                        "That seems to be taking an emotional toll on you. What has been hardest to cope with?"
                    ],

                    "disappointment": [
                        "It sounds like you're still carrying that disappointment. Are you mainly disappointed with your results, or with what you think they say about you?",
                        "That disappointment seems to be affecting how you see yourself. What would you want to be different?"
                    ],

                    "neutral": [
                        "It sounds like this is still on your mind. What part of the exam situation would you most like to work through?",
                        "You mentioned your exams earlier. What is the biggest concern for you right now?"
                    ],

                    "default": [
                        "It sounds like this is still weighing on you. What part of the situation feels most difficult right now?",
                        "It seems like the academic pressure is continuing. What usually happens when you start thinking about it?"
                    ]
                }
            },

            # =====================================================
            # FAMILY
            # =====================================================

            "family": {

                "reflect_and_explore": {

                    "fear": [
                        "It sounds like you're afraid of disappointing your parents. What do you think you're most afraid they will say or think?",
                        "It seems like your parents' expectations are creating a lot of fear for you. What feels most difficult about that pressure?",
                        "You seem worried not only about the exams, but also about how your parents might react. What part of that worries you most?"
                    ],

                    "sadness": [
                        "It sounds painful to feel that you might disappoint your parents. What do you wish they understood about what you're going through?",
                        "It seems like their expectations are affecting you deeply. What hurts the most about feeling that you may disappoint them?"
                    ],

                    "disappointment": [
                        "It sounds like the possibility of disappointing your parents is weighing heavily on you. What do you think would happen if you didn't meet their expectations?",
                        "It seems like their expectations are tied closely to how you're feeling about yourself. What makes their disappointment feel so difficult?"
                    ],

                    "anger": [
                        "It sounds like being compared or judged by your family is frustrating you. What about those comparisons bothers you the most?",
                        "It seems like their expectations are putting you under a lot of pressure. What do you wish they would stop doing?"
                    ],

                    "neutral": [
                        "It sounds like your family has a strong influence on how you're feeling about this. What is the hardest part of their expectations?",
                        "You mentioned your parents and their expectations. What would you most like them to understand about your situation?"
                    ],

                    "default": [
                        "It sounds like your family's expectations are putting a lot of pressure on you. What feels hardest about that?",
                        "It seems like your relationship with your parents is connected to what you're going through. What part of it would you like to talk about?"
                    ]
                },

                "reflect_and_follow": {

                    "fear": [
                        "It sounds like you're still worried about how your parents will react. When you imagine disappointing them, what goes through your mind?",
                        "That fear seems to be connected to their expectations. Do you feel you have to meet their standards to feel successful?"
                    ],

                    "sadness": [
                        "It sounds like this has been emotionally difficult for you. Do you feel able to tell your parents how much their comparisons affect you?",
                        "That seems to be hurting you quite deeply. What usually happens when your parents compare you with someone else?"
                    ],

                    "disappointment": [
                        "It sounds like their expectations are affecting how you see yourself. Have you started comparing yourself with your cousin too?",
                        "That disappointment seems to be carrying over into how you feel about yourself. What do you usually tell yourself afterward?"
                    ],

                    "neutral": [
                        "You mentioned that your parents keep comparing you with your cousin. What usually happens when they do that?",
                        "It sounds like the comparisons are an ongoing issue. How do you normally respond when it happens?"
                    ],

                    "default": [
                        "It sounds like this family pressure is still affecting you. What usually happens when your parents compare you with someone else?",
                        "That seems to be something that stays with you. How do you usually respond when those comparisons happen?"
                    ]
                }
            },

            # =====================================================
            # RELATIONSHIPS
            # =====================================================

            "relationships": {

                "reflect_and_explore": {

                    "sadness": [
                        "It sounds like you've been hurt by what happened in this relationship. What part has been hardest for you to accept?",
                        "It seems like this relationship means a lot to you. What do you wish had happened differently?"
                    ],

                    "fear": [
                        "It sounds like you're worried about losing this relationship. What are you most afraid might happen?",
                        "There seems to be a lot of uncertainty around this relationship. What part worries you most?"
                    ],

                    "anger": [
                        "It sounds like what happened has left you frustrated or angry. What feels most unfair about the situation?",
                        "It seems like you have a lot of frustration toward this person. What do you wish they understood?"
                    ],

                    "disappointment": [
                        "It sounds like you're disappointed by how this relationship has turned out. What were you hoping would happen instead?",
                        "It seems like something important didn't go the way you hoped. What has been hardest about that?"
                    ],

                    "neutral": [
                        "It sounds like this relationship is important to you. What would you like to make sense of about the situation?",
                        "What part of this relationship feels most important to talk about right now?"
                    ],

                    "default": [
                        "It sounds like this relationship has been difficult for you. What has been the hardest part?",
                        "It seems like there is a lot going on in this relationship. What would you like to talk through first?"
                    ]
                },

                "reflect_and_follow": {

                    "sadness": [
                        "It sounds like this is still hurting you. What usually comes to mind when you think about what happened?",
                        "That hurt seems to be staying with you. Have you been able to talk to anyone you trust about it?"
                    ],

                    "fear": [
                        "It sounds like the uncertainty is still worrying you. What do you find yourself expecting will happen next?",
                        "That fear seems to be staying with you. Is there something you wish you could do about the situation?"
                    ],

                    "anger": [
                        "It sounds like you're still frustrated about what happened. Has that anger changed how you interact with the person?",
                        "That frustration seems to be lingering. What would help you feel that the situation had been handled fairly?"
                    ],

                    "default": [
                        "It sounds like this is still affecting you. What usually goes through your mind when you think about it?",
                        "That situation seems to be staying with you. How has it been affecting you lately?"
                    ]
                }
            },

            # =====================================================
            # WORK
            # =====================================================

            "work": {

                "reflect_and_explore": {

                    "anxiety": [
                        "It sounds like work is creating a lot of anxiety for you. What part of your workload feels most difficult right now?",
                        "It seems like the pressure at work has been building up. What is causing the most stress?"
                    ],

                    "fear": [
                        "It sounds like you're worried about what might happen at work. What are you most afraid of?",
                        "There seems to be a lot of pressure around your responsibilities. What feels most uncertain right now?"
                    ],

                    "sadness": [
                        "It sounds like work has been taking a lot out of you emotionally. What has been hardest lately?",
                        "It seems like your work situation is affecting your mood. What part has been most difficult?"
                    ],

                    "anger": [
                        "It sounds like you're frustrated with the situation at work. What feels most unfair or unreasonable?",
                        "It seems like something at work has really been getting under your skin. What happened?"
                    ],

                    "default": [
                        "It sounds like your responsibilities have become difficult to manage. What part is putting the most pressure on you?",
                        "It seems like work has been taking a lot out of you. What feels hardest to keep up with?"
                    ]
                },

                "reflect_and_follow": {

                    "anxiety": [
                        "It sounds like the work pressure is continuing. How has it been affecting you outside of work?",
                        "That stress seems to be following you beyond work. When do you notice it most?"
                    ],

                    "sadness": [
                        "It sounds like work is still weighing on you. Have you been able to get any time to recover from that pressure?",
                        "That sounds emotionally exhausting. What has helped even a little when work feels overwhelming?"
                    ],

                    "default": [
                        "It sounds like the workload is still building up. How has it been affecting the rest of your life?",
                        "That pressure seems to be continuing. What usually happens when you feel you can't keep up?"
                    ]
                }
            },

            # =====================================================
            # SELF
            # =====================================================

            "self": {

                "reflect_and_explore": {

                    "disappointment": [
                        "It sounds like you're being really hard on yourself. When you say you're not good enough, what are you comparing yourself against?",
                        "It seems like this situation has affected the way you see yourself. What makes you feel that you're not good enough?",
                        "That sounds painful to carry. Is there something specific that happened that made you start feeling this way?"
                    ],

                    "sadness": [
                        "It sounds like you're carrying a lot of sadness about yourself. What makes those thoughts feel especially strong right now?",
                        "It seems like you're struggling with how you see yourself. What would you want to believe about yourself instead?"
                    ],

                    "fear": [
                        "It sounds like you're afraid that you aren't good enough. What are you most afraid this says about you?",
                        "That fear seems to be connected to how you see yourself. When did you start feeling this way?"
                    ],

                    "anger": [
                        "It sounds like you're frustrated with yourself. What are you expecting from yourself that feels difficult to reach?",
                        "It seems like you're putting a lot of pressure on yourself. Where do you think those expectations come from?"
                    ],

                    "neutral": [
                        "You mentioned feeling like you're not good enough. What makes you feel that way?",
                        "It sounds like you're questioning yourself quite a lot. What situation has been contributing to those thoughts?"
                    ],

                    "default": [
                        "It sounds like you're being quite hard on yourself. What makes you feel that you aren't good enough?",
                        "It seems like you're carrying a lot of self-doubt. What tends to trigger those thoughts?"
                    ]
                },

                "reflect_and_follow": {

                    "disappointment": [
                        "It sounds like those thoughts about not being good enough are still affecting you. What do you usually tell yourself when they come up?",
                        "That self-doubt seems to be continuing. Are you judging yourself mainly because of what happened recently, or has this feeling been there for a while?"
                    ],

                    "sadness": [
                        "It sounds like you're still struggling with how you see yourself. Are there moments when you feel even a little differently about yourself?",
                        "That feeling seems to be weighing on you. What usually helps, even briefly, when you're feeling this way?"
                    ],

                    "fear": [
                        "It sounds like the fear is still affecting how you see yourself. What do you imagine will happen if you don't meet your own expectations?",
                        "That fear seems closely connected to your self-confidence. What would make you feel a little safer or more confident right now?"
                    ],

                    "neutral": [
                        "You mentioned feeling like you're not good enough. Has that thought been there for a long time?",
                        "It sounds like this self-doubt is something you're trying to understand. What usually brings it up?"
                    ],

                    "default": [
                        "It sounds like these doubts are still affecting how you see yourself. What do you usually tell yourself when you feel this way?",
                        "That feeling seems to be weighing on you. Has it been getting stronger recently?"
                    ]
                }
            },

            # =====================================================
            # FUTURE
            # =====================================================

            "future": {

                "reflect_and_explore": {

                    "fear": [
                        "It sounds like uncertainty about the future is frightening you. What are you most afraid might happen?",
                        "It seems like not knowing what comes next is creating a lot of fear. What part feels most uncertain?"
                    ],

                    "anxiety": [
                        "It sounds like you're feeling anxious about what comes next. What decision or possibility is weighing on you most?",
                        "The uncertainty around your future seems difficult to sit with. What are you worried about getting wrong?"
                    ],

                    "sadness": [
                        "It sounds like thinking about the future has been emotionally difficult. What were you hoping your future would look like?",
                        "It seems like you've been struggling to feel hopeful about what's ahead. What makes the future feel difficult right now?"
                    ],

                    "neutral": [
                        "It sounds like you're thinking seriously about your future. What part feels most unclear right now?",
                        "What is the biggest question about your future that you'd like to work through?"
                    ],

                    "default": [
                        "It sounds like uncertainty about the future is worrying you. What part feels most unclear right now?",
                        "It seems like not knowing what comes next is creating pressure. What are you most concerned about?"
                    ]
                },

                "reflect_and_follow": {

                    "fear": [
                        "It sounds like that uncertainty is still frightening you. What possibility keeps coming back to your mind?",
                        "That fear about the future seems to be staying with you. What would help you feel a little more prepared?"
                    ],

                    "anxiety": [
                        "It sounds like the uncertainty is continuing to make you anxious. Is there one decision you feel you need to make first?",
                        "That pressure seems to be building around the future. What feels most within your control right now?"
                    ],

                    "default": [
                        "It sounds like this uncertainty is still on your mind. What feels most important to figure out first?",
                        "That concern about the future seems to be continuing. What part would you like to work through?"
                    ]
                }
            },

            # =====================================================
            # UNKNOWN
            # =====================================================

            "unknown": {

                "reflect_and_explore": {

                    "fear": [
                        "It sounds like something is making you feel afraid. Would you like to tell me a little more about what is happening?",
                        "It seems like something is weighing heavily on you. What feels most frightening right now?"
                    ],

                    "sadness": [
                        "It sounds like you're going through something difficult. What has been weighing on you the most?",
                        "It seems like you've been carrying a lot emotionally. Where would you like to start?"
                    ],

                    "anxiety": [
                        "It sounds like something has been making you anxious. What feels most overwhelming right now?",
                        "It seems like there is a lot on your mind. What concern is taking up the most space?"
                    ],

                    "neutral": [
                        "It sounds like there is something you'd like to talk through. What feels most important right now?",
                        "What would you like me to understand about what you're going through?"
                    ],

                    "default": [
                        "It sounds like there is a lot going on for you right now. What feels most difficult?",
                        "It seems like something has been weighing on you. Where would you like to start?"
                    ]
                },

                "reflect_and_follow": {

                    "fear": [
                        "It sounds like this is still worrying you. What part feels most difficult right now?"
                    ],

                    "sadness": [
                        "It sounds like this is still affecting you. What feels most important to talk about?"
                    ],

                    "anxiety": [
                        "It sounds like this is still on your mind. What would help you make sense of it?"
                    ],

                    "default": [
                        "It sounds like this is still affecting you. What part feels most important to talk about right now?"
                    ]
                }
            }
        }

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

            raise ValueError(
                "analysis must be a dictionary"
            )

        # =====================================================
        # EXTRACT ANALYSIS
        # =====================================================

        user_text = analysis.get(
            "text",
            ""
        )

        topic = analysis.get(
            "topic"
        ) or "unknown"

        emotion = analysis.get(
            "emotion"
        )

        strategy = analysis.get(
            "strategy",
            "reflect_and_explore"
        )

        # =====================================================
        # EXTRACT RISK
        # =====================================================

        risk = analysis.get(
            "risk"
        )

        risk_level = None

        if isinstance(risk, dict):

            risk_level = (
                risk.get("risk_level")
                or risk.get("level")
            )

        elif isinstance(risk, str):

            risk_level = risk

        # =====================================================
        # NORMALIZE VALUES
        # =====================================================

        topic = self._normalize_topic(
            topic
        )

        emotion = self._normalize_emotion(
            emotion
        )

        strategy = self._normalize_strategy(
            strategy
        )

        risk_level = self._normalize_risk(
            risk_level
        )

        # =====================================================
        # CONVERSATION HISTORY
        # =====================================================

        conversation_history = []

        if state is not None:

            try:

                conversation_history = (
                    state.get_recent_history(
                        limit=8
                    )
                )

            except Exception:

                conversation_history = getattr(
                    state,
                    "history",
                    []
                )

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
                analysis=analysis
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
            user_text=user_text
        )

    # =========================================================
    # NORMALIZATION
    # =========================================================

    def _normalize_topic(
        self,
        topic: Optional[str]
    ) -> str:

        if not topic:

            return "unknown"

        topic = str(
            topic
        ).strip().lower()

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
            "self_doubt": "self"
        }

        return aliases.get(
            topic,
            topic
        )

    def _normalize_emotion(
        self,
        emotion: Optional[str]
    ) -> str:

        if not emotion:

            return "default"

        emotion = str(
            emotion
        ).strip().lower()

        aliases = {

            "worry": "anxiety",
            "worried": "anxiety",
            "nervous": "anxiety",
            "nervousness": "anxiety",

            "fearful": "fear",
            "scared": "fear",

            "sad": "sadness",

            "disappointed": "disappointment",

            "angry": "anger"
        }

        return aliases.get(
            emotion,
            emotion
        )

    def _normalize_strategy(
        self,
        strategy: Optional[str]
    ) -> str:

        valid_strategies = (
            "reflect_and_explore",
            "reflect_and_follow"
        )

        if strategy in valid_strategies:

            return strategy

        return "reflect_and_explore"

    def _normalize_risk(
        self,
        risk_level: Optional[str]
    ) -> Optional[str]:

        if not risk_level:

            return None

        risk_level = str(
            risk_level
        ).strip().lower()

        aliases = {

            "minimal": "low",
            "moderate": "medium",
            "elevated": "medium",
            "high_risk": "high"
        }

        return aliases.get(
            risk_level,
            risk_level
        )

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
        analysis: Dict[str, Any]
    ) -> Optional[str]:

        """
        Generate a natural response using Hugging Face
        Inference Providers.

        The LLM does NOT perform:
        - topic classification
        - emotion classification
        - risk classification
        - strategy selection

        Those decisions have already been made by
        ConversationAnalyzer.

        If Hugging Face is unavailable, this method returns None
        and the existing fallback response system is used.
        """

        # =====================================================
        # CHECK LLM CONFIGURATION
        # =====================================================

        if not self.llm_enabled:

            return None

        if self.hf_client is None:

            return None

        # =====================================================
        # HIGH RISK
        # =====================================================
        #
        # Do not ask the general LLM to improvise crisis handling.
        #
        # The existing deterministic high-risk response remains
        # authoritative.
        #

        if risk_level == "high":

            return None

        # =====================================================
        # BUILD HISTORY
        # =====================================================

        history_messages = []

        if isinstance(
            conversation_history,
            list
        ):

            for item in conversation_history:

                if not isinstance(
                    item,
                    dict
                ):

                    continue

                role = item.get(
                    "role"
                )

                # -------------------------------------------------
                # User message
                # -------------------------------------------------

                if role == "user":

                    content = (
                        item.get("user")
                        or item.get("text")
                        or item.get("content")
                    )

                    if content:

                        history_messages.append(
                            {
                                "role": "user",
                                "content": str(content)
                            }
                        )

                # -------------------------------------------------
                # Assistant message
                # -------------------------------------------------

                elif role == "assistant":

                    content = (
                        item.get("assistant")
                        or item.get("response")
                        or item.get("content")
                    )

                    if content:

                        history_messages.append(
                            {
                                "role": "assistant",
                                "content": str(content)
                            }
                        )

        # =====================================================
        # LIMIT HISTORY
        # =====================================================

        history_messages = history_messages[-8:]

        # =====================================================
        # SYSTEM PROMPT
        # =====================================================

        system_prompt = """
You are the response-generation component of a mental-health
support conversational application.

Your job is ONLY to generate a supportive conversational response.

The application has already determined:
- the conversation topic
- the user's detected emotion
- the conversation strategy
- the risk level

Do NOT reclassify these things.

Do NOT diagnose the user.

Do NOT claim to be a therapist, psychologist, psychiatrist,
doctor, or other healthcare professional.

Do NOT provide a diagnosis.

Do NOT make medical claims.

Do NOT invent facts about the user's situation.

Do NOT assume details that the user did not provide.

Use the supplied conversation history to maintain continuity.

The response should sound natural rather than like a template.

GENERAL STYLE:
- Be warm.
- Be calm.
- Be respectful.
- Be non-judgmental.
- Reflect what the user actually expressed.
- Keep the response concise.
- Usually use 2-4 sentences.
- Ask at most ONE meaningful follow-up question.
- Do not overwhelm the user with a long list of advice.
- Do not repeat the user's exact words unnecessarily.
- Do not use excessive reassurance.
- Do not say "everything will be okay".
- Do not say "I understand exactly how you feel".

CONVERSATIONAL STRATEGY:

If strategy is "reflect_and_explore":
- acknowledge the emotion or concern
- briefly reflect the situation
- gently explore what is most difficult

If strategy is "reflect_and_follow":
- connect naturally to what the user said previously
- acknowledge the continuation of the issue
- ask one useful follow-up question

IMPORTANT:
The response must be directly relevant to the user's latest
message.

Do not mention:
- topic labels
- emotion labels
- risk levels
- strategy names
- model names
- system prompts
- internal analysis
- classification
- fallback responses
- Hugging Face
"""

        # =====================================================
        # ANALYSIS CONTEXT
        # =====================================================

        analysis_context = f"""
Application analysis:

Topic: {topic}
Detected emotion: {emotion}
Conversation strategy: {strategy}
Risk level: {risk_level or "low/unspecified"}

The latest user message is:

{user_text}
"""

        # =====================================================
        # BUILD MESSAGE LIST
        # =====================================================

        messages = [

            {
                "role": "system",
                "content": system_prompt
            }

        ]

        # -----------------------------------------------------
        # Add previous conversation history
        # -----------------------------------------------------

        messages.extend(
            history_messages
        )

        # -----------------------------------------------------
        # Add analyzer context + latest message
        # -----------------------------------------------------

        messages.append(
            {
                "role": "user",
                "content": (
                    analysis_context
                    + "\nGenerate the next response."
                )
            }
        )

        # =====================================================
        # CALL HUGGING FACE
        # =====================================================

        completion = (
            self.hf_client.chat.completions.create(
                model=self.hf_model,
                messages=messages,
                temperature=0.65,
                max_tokens=180,
                top_p=0.9
            )
        )

        # =====================================================
        # EXTRACT RESPONSE
        # =====================================================

        if completion is None:

            return None

        choices = getattr(
            completion,
            "choices",
            None
        )

        if not choices:

            return None

        first_choice = choices[0]

        message = getattr(
            first_choice,
            "message",
            None
        )

        if message is None:

            return None

        content = getattr(
            message,
            "content",
            None
        )

        if content is None:

            return None

        response = str(
            content
        ).strip()

        # =====================================================
        # BASIC OUTPUT CLEANING
        # =====================================================

        if not response:

            return None

        # Remove accidental role prefixes.

        prefixes = [
            "Assistant:",
            "assistant:",
            "Response:",
            "response:"
        ]

        for prefix in prefixes:

            if response.startswith(prefix):

                response = response[
                    len(prefix):
                ].strip()

        # =====================================================
        # SAFETY / QUALITY GUARDS
        # =====================================================

        if not self._is_valid_llm_response(
            response=response,
            user_text=user_text
        ):

            print(
                "Hugging Face returned a response that "
                "failed validation. Using fallback."
            )

            return None

        return response

    # =========================================================
    # LLM RESPONSE VALIDATION
    # =========================================================

    def _is_valid_llm_response(
        self,
        response: str,
        user_text: str
    ) -> bool:

        """
        Lightweight output validation.

        This is NOT a replacement for a dedicated safety layer.
        It simply prevents obviously malformed responses from
        being returned to the user.
        """

        if not response:

            return False

        # -----------------------------------------------------
        # Length protection
        # -----------------------------------------------------

        if len(response) < 5:

            return False

        if len(response) > 1200:

            return False

        # -----------------------------------------------------
        # Reject obvious model/meta leakage
        # -----------------------------------------------------

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

            "qwen3"
        ]

        response_lower = response.lower()

        for phrase in forbidden_phrases:

            if phrase in response_lower:

                return False

        # -----------------------------------------------------
        # Reject obvious empty/meta responses
        # -----------------------------------------------------

        invalid_exact = {

            "okay",

            "ok",

            "sure",

            "i understand",

            "understood",

            "noted"
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
        user_text: str
    ) -> str:

        # =====================================================
        # SAFETY-AWARE RESPONSES
        # =====================================================

        if risk_level == "high":

            return self._high_risk_response(
                topic=topic
            )

        # =====================================================
        # GET TOPIC
        # =====================================================

        topic_responses = self.fallback_responses.get(
            topic,
            self.fallback_responses["unknown"]
        )

        # =====================================================
        # GET STRATEGY
        # =====================================================

        strategy_responses = topic_responses.get(
            strategy,
            topic_responses[
                "reflect_and_explore"
            ]
        )

        # =====================================================
        # GET EMOTION
        # =====================================================

        responses = strategy_responses.get(
            emotion
        )

        # -----------------------------------------------------
        # If no emotion-specific response exists,
        # use the default response.
        # -----------------------------------------------------

        if not responses:

            responses = strategy_responses.get(
                "default"
            )

        # =====================================================
        # FINAL FALLBACK
        # =====================================================

        if not responses:

            responses = [
                "It sounds like this has been difficult for you. What feels most important to talk about right now?"
            ]

        # =====================================================
        # REMOVE RECENTLY USED RESPONSES
        # =====================================================

        recent_responses = (
            self._get_recent_assistant_responses(
                conversation_history
            )
        )

        available = [

            response

            for response in responses

            if response not in recent_responses

        ]

        # -----------------------------------------------------
        # If every response was recently used,
        # allow the bank to rotate again.
        # -----------------------------------------------------

        if not available:

            available = responses

        # =====================================================
        # ROTATE RESPONSES
        # =====================================================

        selected = self._select_response(
            available,
            conversation_history
        )

        return selected

    # =========================================================
    # RESPONSE SELECTION
    # =========================================================

    def _select_response(
        self,
        responses: List[str],
        conversation_history: List[Dict[str, Any]]
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

        # -----------------------------------------------------
        # Count assistant responses already given.
        # -----------------------------------------------------

        assistant_count = sum(

            1

            for item in conversation_history

            if (
                isinstance(item, dict)
                and item.get("role") == "assistant"
            )

        )

        index = (
            assistant_count
            % len(responses)
        )

        return responses[index]

    # =========================================================
    # RECENT ASSISTANT RESPONSES
    # =========================================================

    def _get_recent_assistant_responses(
        self,
        conversation_history: List[Dict[str, Any]],
        limit: int = 4
    ) -> List[str]:

        responses = []

        for item in reversed(
            conversation_history
        ):

            if not isinstance(
                item,
                dict
            ):

                continue

            if item.get("role") != "assistant":

                continue

            response = (
                item.get("assistant")
                or item.get("response")
                or item.get("content")
            )

            if response:

                responses.append(
                    response
                )

            if len(responses) >= limit:

                break

        return responses

    # =========================================================
    # HIGH RISK RESPONSE
    # =========================================================

    def _high_risk_response(
        self,
        topic: str
    ) -> str:

        """
        Conservative response for high-risk situations.

        Detailed crisis handling should eventually be implemented
        as a dedicated safety component rather than relying only
        on the response generator.
        """

        return (
            "It sounds like you're going through something very "
            "difficult right now. Your safety is more important "
            "than solving everything at once. Are you in immediate "
            "danger of hurting yourself or someone else right now?"
        )