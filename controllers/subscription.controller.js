import Subscription from '../models/subscription.model.js'
import { workflowClient } from '../config/upstash.js'
import { SERVER_URL } from '../config/env.js'

export const createSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.create({
      ...req.body,
      user: req.user._id,
    });

    const { workflowRunId } = await workflowClient.trigger({
      url: `${SERVER_URL}/api/v1/workflows/subscription/reminder`,
      body: {
        subscriptionId: subscription.id,
      },
      headers: {
        'content-type': 'application/json',
      },
      retries: 0,
    })

    res.status(201).json({ success: true, data: { subscription, workflowRunId } });
  } catch (e) {
    next(e);
  }
}

export const getUserSubscriptions = async (req, res, next) => {
  try {
    // Check if the user is the same as the one in the token
    if(req.user.id !== req.params.id) {
      const error = new Error('You are not the owner of this account');
      error.status = 401;
      throw error;
    }

    const subscriptions = await Subscription.find({ user: req.params.id });

    res.status(200).json({ success: true, data: subscriptions });
  } catch (e) {
    next(e);
  }
}

export const getAllSubscriptions = async (req, res, next) => {
    try {
        // This should ideally be an admin-only route, but for now, it's open.
        const subscriptions = await Subscription.find({});
        res.status(200).json({ success: true, count: subscriptions.length, data: subscriptions });
    } catch(e) {
        next(e);
    }
};

export const getSubscriptionDetails = async (req, res, next) => {
    try {
        const subscription = await Subscription.findById(req.params.id);
        if (!subscription) {
            const error = new Error('Subscription not found');
            error.status = 404;
            throw error;
        }
        checkPermissions(req.user, subscription.user);
        res.status(200).json({ success: true, data: subscription });
    } catch(e) {
        next(e);
    }
};

export const updateSubscription = async (req, res, next) => {
    try {
        const subscription = await Subscription.findById(req.params.id);
        if (!subscription) {
            const error = new Error('Subscription not found');
            error.status = 404;
            throw error;
        }
        checkPermissions(req.user, subscription.user);

        const updatedSubscription = await Subscription.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        res.status(200).json({ success: true, data: updatedSubscription });
    } catch(e) {
        next(e);
    }
};

export const deleteSubscription = async (req, res, next) => {
    try {
        const subscription = await Subscription.findById(req.params.id);
        if (!subscription) {
            const error = new Error('Subscription not found');
            error.status = 404;
            throw error;
        }
        checkPermissions(req.user, subscription.user);
        await subscription.deleteOne();
        res.status(200).json({ success: true, message: 'Subscription deleted' });
    } catch(e) {
        next(e);
    }
};

export const cancelSubscription = async (req, res, next) => {
    try {
        const subscription = await Subscription.findById(req.params.id);
        if (!subscription) {
            const error = new Error('Subscription not found');
            error.status = 404;
            throw error;
        }
        checkPermissions(req.user, subscription.user);
        subscription.status = 'cancelled';
        await subscription.save();
        res.status(200).json({ success: true, message: 'Subscription cancelled', data: subscription });
    } catch(e) {
        next(e);
    }
};

export const getUpcomingRenewals = async (req, res, next) => {
    try {
        const days = parseInt(req.query.days, 10) || 7;
        const today = new Date();
        const upcomingDate = new Date();
        upcomingDate.setDate(today.getDate() + days);

        const subscriptions = await Subscription.find({
            user: req.user._id,
            status: 'active',
            nextBillingDate: {
                $gte: today,
                $lte: upcomingDate,
            },
        }).sort({ nextBillingDate: 'asc' });

        res.status(200).json({ success: true, count: subscriptions.length, data: subscriptions });
    } catch (e) {
        next(e);
    }
};
