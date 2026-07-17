const service = require("./twin.service");
const userId = (req) => req.user?._id || req.user?.id;
const fail = (res, e, message) => { console.error(message, e); return res.status(e.statusCode || 500).json({ success: false, message: e.message || message }); };
const limit = async (user) => { const plan = String(user?.plan || "free").toLowerCase(); const max = plan === "business" ? Infinity : plan === "pro" ? 3 : 1; const count = await service.getTwinCount(user._id || user.id); if (Number.isFinite(max) && count >= max) { const e = new Error(`Your ${plan} plan supports only ${max} AI Twin(s).`); e.statusCode = 403; throw e; } };
exports.saveBasicInfo = async (req,res) => { try { await limit(req.user); const twin = await service.createBasicInfo({ userId:userId(req), payload:req.body }); res.status(201).json({ success:true, message:"AI Twin basic information saved successfully.", twin, data:{ id:twin._id, twinId:twin._id, twin_id:twin._id, twin_name:twin.name } }); } catch(e){ fail(res,e,"Unable to save basic information."); } };
exports.saveAppearance = async (req,res) => { try { const twin = await service.saveAppearance({ userId:userId(req), payload:req.body, file:req.file }); res.status(201).json({ success:true, message:"AI Twin appearance saved successfully.", appearance:twin.appearance, twin }); } catch(e){ fail(res,e,"Unable to save appearance."); } };
exports.saveVoice = async (req,res) => { try { const twin = await service.saveVoice({ userId:userId(req), payload:req.body, file:req.file }); res.status(201).json({ success:true, message:"AI Twin voice saved successfully.", voice:twin.voice, twin }); } catch(e){ fail(res,e,"Unable to save voice."); } };
exports.saveKnowledge = async (req,res) => { try { const r = await service.saveKnowledge({ userId:userId(req), payload:req.body, file:req.file }); res.status(201).json({ success:true, message:"Knowledge processed and embedded successfully.", chunkCount:r.chunkCount, chunks:r.chunks.map(c=>({ id:c._id, title:c.sourceTitle, content:c.content, sourceType:c.sourceType })), twin:r.twin }); } catch(e){ fail(res,e,"Unable to process knowledge."); } };
exports.trainProduct = async (req,res) => { try { const r = await service.trainProduct({ userId:userId(req), twinId:req.params.id, productId:req.params.productId, payload:req.body, file:req.file }); res.status(201).json({ success:true, message:"Product knowledge trained successfully.", chunkCount:r.chunkCount, twin:r.twin }); } catch(e){ fail(res,e,"Unable to train product."); } };
exports.chatWithTwin = async (req,res) => { try { const r = await service.chat({ userId:userId(req), payload:req.body }); res.json({ success:true, reply:r.reply, data:r }); } catch(e){ fail(res,e,"Unable to chat with AI Twin."); } };
exports.textToSpeech = async (req,res) => { try { res.json({ success:true, data:await service.textToSpeech({ userId:userId(req), payload:req.body }) }); } catch(e){ fail(res,e,"Unable to generate speech."); } };
exports.speechToText = async (req,res) => { try { const r = await service.speechToText({ userId:userId(req), payload:req.body, file:req.file }); res.json({ success:true, transcript:r.transcript, data:r }); } catch(e){ fail(res,e,"Unable to transcribe speech."); } };
exports.speechToSpeech = async (req,res) => { try { const r = await service.speechToSpeech({ userId:userId(req), payload:req.body, file:req.file }); res.json({ success:true, ...r, data:r }); } catch(e){ fail(res,e,"Unable to complete speech conversation."); } };
exports.createTalkingAvatar = async (req,res) => { try { res.status(202).json({ success:true, message:"Talking-avatar generation started.", data:await service.createTalkingAvatar({ userId:userId(req), payload:req.body }) }); } catch(e){ fail(res,e,"Unable to create talking avatar."); } };
exports.getTalkingAvatarStatus = async (req,res) => { try { res.json({ success:true, data:await service.getTalkingAvatarStatus({ userId:userId(req), generationId:req.params.generationId }) }); } catch(e){ fail(res,e,"Unable to load avatar status."); } };
exports.getTwins = async (req,res) => { try { const twins = await service.getTwins(userId(req)); res.json({ success:true, count:twins.length, twins }); } catch(e){ fail(res,e,"Unable to load AI Twins."); } };
exports.getTwin = async (req,res) => { try { res.json({ success:true, twin:await service.getTwin({ userId:userId(req), twinId:req.params.id }) }); } catch(e){ fail(res,e,"Unable to load AI Twin."); } };
exports.getKnowledge = async (req,res) => { try { const knowledge = await service.getKnowledge({ userId:userId(req), twinId:req.params.id, productId:req.query.productId || null }); res.json({ success:true, count:knowledge.length, knowledge }); } catch(e){ fail(res,e,"Unable to load knowledge."); } };
exports.getConversations = async (req,res) => { try { res.json({ success:true, conversations:await service.getConversations({ userId:userId(req), twinId:req.params.id }) }); } catch(e){ fail(res,e,"Unable to load conversations."); } };
exports.deleteTwin = async (req,res) => { try { const twin = await service.deleteTwin({ userId:userId(req), twinId:req.params.id }); res.json({ success:true, message:"AI Twin deleted successfully.", deletedTwinId:twin._id }); } catch(e){ fail(res,e,"Unable to delete AI Twin."); } };
exports.updateTwin = async (
  req,
  res
) => {
  try {
    const twin =
      await service.updateTwin({
        userId:
          userId(req),

        twinId:
          req.params.id,

        payload:
          req.body,
      });

    return res.json({
      success: true,

      message:
        "AI Twin updated successfully.",

      twin,
    });
  } catch (error) {
    return fail(
      res,
      error,
      "Unable to update AI Twin."
    );
  }
};