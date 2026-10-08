import * as roomService from "../services/room.service.js";

export async function list(req, res) {
  res.json({ items: await roomService.listRooms(req.user._id) });
}

export async function invitations(req, res) {
  res.json({ items: await roomService.listInvitations(req.user._id) });
}

export async function agenda(req, res) {
  res.json({
    items: await roomService.getAgenda(req.user._id, req.valid.query),
  });
}

export async function create(req, res) {
  const room = await roomService.createRoom(req.user, req.valid.body);
  res.status(201).json({ room });
}

export async function get(req, res) {
  res.json({ room: await roomService.getRoomDetail(req.room._id) });
}

export async function update(req, res) {
  res.json({
    room: await roomService.updateRoom(req.room, req.user, req.valid.body),
  });
}

export async function remove(req, res) {
  await roomService.deleteRoom(req.room);
  res.status(204).end();
}

export async function invite(req, res) {
  res.json({
    room: await roomService.inviteFriends(
      req.room,
      req.user,
      req.valid.body.userIds,
    ),
  });
}

export async function acceptInvitation(req, res) {
  res.json({
    room: await roomService.acceptInvitation(req.valid.params.roomId, req.user),
  });
}

export async function declineInvitation(req, res) {
  await roomService.declineInvitation(req.valid.params.roomId, req.user);
  res.status(204).end();
}

export async function cancelInvitation(req, res) {
  res.json({
    room: await roomService.cancelInvitation(req.room, req.valid.params.userId),
  });
}

export async function updateMember(req, res) {
  const room = await roomService.updateMemberRole(
    req.room,
    req.user,
    req.valid.params.userId,
    req.valid.body.role,
  );
  res.json({ room });
}

export async function removeMember(req, res) {
  const room = await roomService.removeMember(
    req.room,
    req.user,
    req.membership,
    req.valid.params.userId,
  );
  res.json({ room });
}

export async function listTasks(req, res) {
  res.json({ items: await roomService.listRoomTasks(req.room._id) });
}

export async function createTask(req, res) {
  res
    .status(201)
    .json({
      room: await roomService.createRoomTask(
        req.room,
        req.user,
        req.valid.body,
      ),
    });
}

export async function updateTask(req, res) {
  const room = await roomService.updateRoomTask(
    req.room,
    req.user,
    req.valid.params.taskId,
    req.valid.body,
  );
  res.json({ room });
}

export async function deleteTask(req, res) {
  const room = await roomService.deleteRoomTask(
    req.room,
    req.user,
    req.membership,
    req.valid.params.taskId,
  );
  res.json({ room });
}
