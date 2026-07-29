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
  const { moduleCrud, requireWorkspaceAccess } = deps;
  if (!moduleCrud) throw new TypeError("registerModuleCrudRoutes requires moduleCrud");
  if (typeof requireWorkspaceAccess !== "function") throw new TypeError("registerModuleCrudRoutes requires requireWorkspaceAccess");

  const send = (res, result) => res.status(result.status).json(result.body);

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

    app.post(`/api/${slug}/${resource}/:id/archive`, guard, async (req, res) =>
      send(res, await moduleCrud.archive(req, productKey, resource, req.params.id)));

    app.post(`/api/${slug}/${resource}/:id/restore`, guard, async (req, res) =>
      send(res, await moduleCrud.restore(req, productKey, resource, req.params.id)));
  }
}

module.exports = registerModuleCrudRoutes;
