import * as friendService from "../services/friend.service.js";

export async function list(req, res) {
  res.json({ items: await friendService.listFriends(req.user._id) });
}

export async function requests(req, res) {
  res.json(await friendService.listRequests(req.user._id));
}

export async function sendRequest(req, res) {
  const result = await friendService.sendRequest(
    req.user,
    req.valid.body.userId,
  );
  res
    .status(result.status === "friends" ? 200 : 201)
    .json({ relationship: result });
}

export async function acceptRequest(req, res) {
  res.json({
    relationship: await friendService.acceptRequest(
      req.user,
      req.valid.params.requestId,
    ),
  });
}

export async function deleteRequest(req, res) {
  await friendService.deleteRequest(req.user, req.valid.params.requestId);
  res.status(204).end();
}

export async function remove(req, res) {
  await friendService.removeFriend(req.user, req.valid.params.userId);
  res.status(204).end();
}
