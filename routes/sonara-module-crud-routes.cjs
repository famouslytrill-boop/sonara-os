"use strict";

// Listing, correcting and retiring the records a customer creates.
//
// These six workspace tools were create-only: you could add a lead, a campaign
// or an asset and then had no way to open one, fix a typo in it, or take it off
// your list. Everything was visible only through the aggregate /records feed.
//
// Registered from one table so the three resources cannot drift apart, and every
// handler passes through requireWorkspaceAccess for the owning product before it
// sees a row. Retiring a record archives it rather than deleting it -- each of
// these tables already carries "archived" in its status check, and the
// businesses resource already works this way.

const { RESOURCES } = require("../lib/sonara-module-crud.cjs");

function registerModuleCrudRoutes(app, deps = {}) {
  const { moduleCrud, requireWorkspaceAccess, wantsJson, responsePage, linkAction } = deps;
  if (!moduleCrud) throw new TypeError("registerModuleCrudRoutes requires moduleCrud");
  if (typeof requireWorkspaceAccess !== "function") throw new TypeError("registerModuleCrudRoutes requires requireWorkspaceAccess");

  const send = (res, result) => res.status(result.status).json(result.body);

  // A browser that submitted a form gets sent back to the page it came from, so
  // the change is visible immediately. An API client gets the JSON it asked for.
  function respond(req, res, result, backHref) {
    if (wantsJson?.(req) || !responsePage) return send(res, result);
    if (result.ok) return res.redirect(303, backHref);
    return res.status(result.status).type("html").send(
      responsePage("That change was not saved", result.body.message || "Check the values and try again.", [
        linkAction(backHref, "Back to your records"),
        linkAction("/support", "Get help")
      ])
    );
  }

  for (const key of Object.keys(RESOURCES)) {
    const [productKey, resource] = key.split(":");
    const slug = productKey.replace(/_/g, "-");
    const guard = requireWorkspaceAccess(productKey);

    app.get(`/api/${slug}/${resource}`, guard, async (req, res) =>
      send(res, await moduleCrud.list(req, productKey, resource)));

    app.get(`/api/${slug}/${resource}/:id`, guard, async (req, res) =>
      send(res, await moduleCrud.getOne(req, productKey, resource, req.params.id)));

    app.patch(`/api/${slug}/${resource}/:id`, guard, async (req, res) =>
      send(res, await moduleCrud.update(req, productKey, resource, req.params.id, req.body)));

    // POST is the same update. HTML forms cannot send PATCH, and the rest of
    // this application is server-rendered and works without JavaScript --
    // correcting a mistyped customer email should not be the one screen that
    // needs it.
    app.post(`/api/${slug}/${resource}/:id`, guard, async (req, res) =>
      respond(req, res, await moduleCrud.update(req, productKey, resource, req.params.id, req.body), `/${slug}/${resource}`));

    app.post(`/api/${slug}/${resource}/:id/archive`, guard, async (req, res) =>
      respond(req, res, await moduleCrud.archive(req, productKey, resource, req.params.id), `/${slug}/${resource}`));

    app.post(`/api/${slug}/${resource}/:id/restore`, guard, async (req, res) =>
      respond(req, res, await moduleCrud.restore(req, productKey, resource, req.params.id), `/${slug}/${resource}`));
  }
}

module.exports = registerModuleCrudRoutes;
