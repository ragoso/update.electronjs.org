'use strict'

const { test } = require('tap')
const fetch = require('node-fetch')
const Updates = require('..')
const assert = require('assert')

const { GH_TOKEN: token } = process.env
assert(token, 'GH_TOKEN required')

const cache = 100

const createServer = () =>
  new Promise(resolve => {
    const updates = new Updates({ token })
    const server = updates.listen(() => {
      resolve({
        server,
        address: `http://localhost:${server.address().port}`
      })
    })
  })

test('Updates', async t => {
  const { server, address } = await createServer()

  await t.test('Routes', async t => {
    const res = await fetch(`${address}/`)
    t.equal(res.status, 404)

    await t.test('exists and has update', async t => {
      for (let i = 0; i < cache; i++) {
        const res = await fetch(`${address}/dat-land/dat-desktop/darwin/1.0.0`)
        t.equal(res.status, 200)
        const body = await res.json()
        t.ok(body.name)
        t.match(body.url, /-mac\.zip$/)
        t.ok(body.notes)
      }
    })

    await t.test('exists but no updates', async t => {
      let res = await fetch(
        `https://api.github.com/repos/dat-land/dat-desktop/releases?per_page=100`,
        { headers: { Authorization: `token ${token}` } }
      )
      const releases = await res.json()
      const release = releases.find(
        release => !release.draft && !release.prerelease
      )

      for (let i = 0; i < cache; i++) {
        res = await fetch(
          `${address}/dat-land/dat-desktop/darwin/${release.name}`
        )
        t.equal(res.status, 204)
      }
    })

    await t.test('parses semver with optional leading v', async t => {
      let res = await fetch(
        `https://api.github.com/repos/dat-land/dat-desktop/releases?per_page=100`,
        { headers: { Authorization: `token ${token}` } }
      )
      const releases = await res.json()
      const release = releases.find(
        release => !release.draft && !release.prerelease
      )

      for (let i = 0; i < cache; i++) {
        res = await fetch(
          `${address}/dat-land/dat-desktop/darwin/v${release.name}`
        )
        t.equal(res.status, 204)
      }
    })

    await t.test('uses release.tag_name not release.name', async t => {
      for (let i = 0; i < cache; i++) {
        const res = await fetch(
          `${address}/MarshallOfSound/Google-Play-Music-Desktop-Player-UNOFFICIAL-/darwin/4.0.0`
        )
        t.equal(res.status, 200)
        const body = await res.json()
        t.equal(body.name, 'Version 4.5.0')
        t.match(body.url, /osx\.zip$/i)
        t.ok(body.notes)
      }
    })

    await t.test('exists but has no releases', async t => {
      for (let i = 0; i < cache; i++) {
        const res = await fetch(
          `${address}/juliangruber/brace-expansion/darwin/0.0.0`
        )
        t.equal(res.status, 404)
      }
    })

    await t.test("doesn't exist", async t => {
      for (let i = 0; i < cache; i++) {
        const res = await fetch(
          `${address}/doesnot/exist-123123123/darwin/0.0.0`
        )
        t.equal(res.status, 404)
      }
    })
  })

  await t.test('Platforms', async t => {
    await t.test('Darwin', async t => {
      for (let i = 0; i < cache; i++) {
        let res = await fetch(`${address}/dat-land/dat-desktop/darwin/1.0.0`)
        t.equal(res.status, 200)
        let body = await res.json()
        t.match(body.url, /-mac\.zip$/)

        res = await fetch(
          `${address}/webtorrent/webtorrent-desktop/darwin/0.0.0`
        )
        t.equal(res.status, 200)
        body = await res.json()
        t.match(body.url, /-darwin\.zip$/)
      }
    })

    await t.test('Win32', async t => {
      await t.test('.exe', async t => {
        for (let i = 0; i < cache; i++) {
          const res = await fetch(`${address}/zeit/hyper/win32/0.0.0`)
          t.equal(res.status, 200)
          const body = await res.json()
          t.match(body.url, /\.exe$/)
          t.ok(body.name)
        }
      })

      await t.test('win32-x64', async t => {
        for (let i = 0; i < cache; i++) {
          const res = await fetch(`${address}/Kilian/fromscratch/win32/0.0.0`)
          t.equal(res.status, 200)
          const body = await res.json()
          t.match(body.url, /win32-x64/)
          t.ok(body.name)
        }
      })

      await t.test('RELEASES', async t => {
        for (let i = 0; i < cache; i++) {
          let res = await fetch(
            `${address}/zeit/hyper/win32/0.0.0/RELEASES?some-extra`
          )
          t.equal(res.status, 200)
          const body = await res.text()
          t.match(
            body,
            /^[^ ]+ https:\/\/github.com\/zeit\/hyper\/releases\/download\/[^/]+\/hyper-[^-]+-full.nupkg [^ ]+$/
          )

          res = await fetch(
            `${address}/juliangruber/brace-expansion/win32/0.0.0/RELEASES`
          )
          t.equal(res.status, 404)
        }
      })
    })
  })

  server.close()
})
