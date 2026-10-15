#pragma once

// ---------------------------------------------------------------------------
//  Stub ATL minimal.
//
//  BlackBone n'utilise que CComPtr (ImageNET.h / PDBHelper.h), uniquement en
//  tant que declaration de membre. L'injecteur (manual map) n'instantie jamais
//  ImageNET / PDBHelper, l'implementation reelle est dans BlackBone.lib.
//  Ce stub fournit CComPtr complet pour que la compilation des en-tetes passe
//  sans le composant "C++ ATL" de Visual Studio.
// ---------------------------------------------------------------------------

#ifndef _ATLBASE_STUB_INCLUDED_
#define _ATLBASE_STUB_INCLUDED_

#include <windows.h>

template <class T>
class CComPtr
{
public:
	CComPtr() : _pT( nullptr ) {}

	CComPtr( T* p ) : _pT( p )
	{
		if ( _pT ) _pT->AddRef();
	}

	CComPtr( const CComPtr& r ) : _pT( r._pT )
	{
		if ( _pT ) _pT->AddRef();
	}

	template <class U>
	CComPtr( const CComPtr<U>& r ) : _pT( r._pT )
	{
		if ( _pT ) _pT->AddRef();
	}

	~CComPtr()
	{
		Release();
	}

	CComPtr& operator=( T* p )
	{
		Release();
		_pT = p;
		if ( _pT ) _pT->AddRef();
		return *this;
	}

	CComPtr& operator=( const CComPtr& r )
	{
		if ( this != &r )
		{
			Release();
			_pT = r._pT;
			if ( _pT ) _pT->AddRef();
		}
		return *this;
	}

	T* operator->() const
	{
		return _pT;
	}

	T** operator&()
	{
		return & _pT;
	}

	operator T*() const
	{
		return _pT;
	}

	bool IsNull() const
	{
		return ( _pT == nullptr );
	}

	T* Get() const
	{
		return _pT;
	}

	void Release()
	{
		if ( _pT )
		{
			_pT->Release();
			_pT = nullptr;
		}
	}

	T* Detach()
	{
		T* p = _pT;
		_pT = nullptr;
		return p;
	}

	void Reset()
	{
		Release();
	}

	template <typename Q>
	HRESULT QueryInterface( Q** pp )
	{
		HRESULT hr = E_NOINTERFACE;

		if ( _pT )
			hr = _pT->QueryInterface( __uuidof( Q ), reinterpret_cast< void** >( pp ) );
		else
			*pp = nullptr;

		return hr;
	}

private:
	T* _pT;
};

#endif
