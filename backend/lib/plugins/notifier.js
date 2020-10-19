const fp = require("fastify-plugin");
const { getSocketIdByUserId } = require("./socket");

class Notifier {
  constructor(app) {
    this.app = app
    this.Notification = app.mongo.model("Notification");
    this.User = app.mongo.model("User");
  }

  async notify(action, post, triggeredById) {
    if (!["like", "comment", "post"].includes(action)) throw new Error('Invalid Notification action');

    const [triggeredByErr, triggeredBy] = await this.app.to(this.User.findById(triggeredById));
    if (triggeredByErr || !triggeredBy) return; 

    const newNotification = {
      action: action,
      post: {
        id: post._id,
        title: post.title,
      },
      receiver: post.author.id,
      readAt: null,
      emailSentAt: null,
      triggeredBy: {
        id: triggeredBy._id,
        name: triggeredBy.name,
        photo: triggeredBy.photo,
        type: triggeredBy.type,
      },
    };

    const [err, notification] = await this.app.to(new this.Notification(newNotification).save());
    if (err) return;

    // send real-time web notification if online
    let userIsOnline = await getSocketIdByUserId(this.app, post.author.id.toString())
    if (userIsOnline) this.app.io.to(userIsOnline).emit('NEW_NOTIFICATION', notification);
  }
}

function fastifyNotifier(app, config, next) {
  try {
    app.decorate("notifier", new Notifier(app));
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = fp(fastifyNotifier);